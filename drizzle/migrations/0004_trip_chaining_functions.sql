CREATE OR REPLACE FUNCTION public.gtfs_seconds(p_time text)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p_time IS NULL OR p_time = '' THEN NULL
    ELSE split_part(p_time, ':', 1)::int * 3600
       + split_part(p_time, ':', 2)::int * 60
       + coalesce(nullif(split_part(p_time, ':', 3), ''), '0')::int
  END;
$$;

CREATE OR REPLACE FUNCTION public.gtfs_distance_m(lat1 numeric, lon1 numeric, lat2 numeric, lon2 numeric)
RETURNS double precision LANGUAGE sql IMMUTABLE AS $$
  SELECT 6371000 * 2 * asin(sqrt(
    power(sin(radians(lat2::double precision - lat1::double precision) / 2), 2)
    + cos(radians(lat1::double precision)) * cos(radians(lat2::double precision))
    * power(sin(radians(lon2::double precision - lon1::double precision) / 2), 2)
  ));
$$;

-- All stations served by any route_type = 1 (rail) route, derived from the feed.
CREATE OR REPLACE FUNCTION public.rail_stations()
RETURNS TABLE(stop_id text, stop_name text, stop_lat numeric, stop_lon numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT DISTINCT s.stop_id, s.stop_name, s.stop_lat, s.stop_lon
  FROM routes r
  JOIN trips t ON t.route_id = r.route_id
  JOIN stop_times st ON st.trip_id = t.trip_id
  JOIN stops s ON s.stop_id = st.stop_id
  WHERE r.route_type = 1
  ORDER BY s.stop_name;
$$;

-- Nearest stop to a coordinate; p_rail_only restricts to rail stations.
CREATE OR REPLACE FUNCTION public.nearest_stop(
  p_lat numeric, p_lon numeric, p_rail_only boolean DEFAULT false
)
RETURNS TABLE(stop_id text, stop_name text, stop_lat numeric, stop_lon numeric, distance_m double precision)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH candidates AS (
    SELECT s.stop_id, s.stop_name, s.stop_lat, s.stop_lon
    FROM stops s
    WHERE s.stop_lat IS NOT NULL AND s.stop_lon IS NOT NULL
      AND (NOT p_rail_only OR s.stop_id IN (SELECT rs.stop_id FROM rail_stations() rs))
      AND (p_rail_only OR EXISTS (
        SELECT 1 FROM stop_times st WHERE st.stop_id = s.stop_id
      ))
  )
  SELECT c.stop_id, c.stop_name, c.stop_lat, c.stop_lon,
         gtfs_distance_m(p_lat, p_lon, c.stop_lat, c.stop_lon) AS distance_m
  FROM candidates c
  ORDER BY gtfs_distance_m(p_lat, p_lon, c.stop_lat, c.stop_lon)
  LIMIT 1;
$$;

-- Service ids active on the current Pacific/Honolulu date.
CREATE OR REPLACE FUNCTION public.active_service_ids()
RETURNS TABLE(service_id text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH d AS (
    SELECT (now() AT TIME ZONE 'Pacific/Honolulu')::date AS today
  )
  SELECT c.service_id
  FROM calendar c, d
  WHERE to_date(c.start_date, 'YYYYMMDD') <= d.today
    AND to_date(c.end_date, 'YYYYMMDD') >= d.today
    AND CASE extract(isodow FROM d.today)
          WHEN 1 THEN c.monday WHEN 2 THEN c.tuesday WHEN 3 THEN c.wednesday
          WHEN 4 THEN c.thursday WHEN 5 THEN c.friday WHEN 6 THEN c.saturday
          ELSE c.sunday END = 1
    AND NOT EXISTS (
      SELECT 1 FROM calendar_dates cd, d d2
      WHERE cd.service_id = c.service_id
        AND cd.date = to_char(d2.today, 'YYYYMMDD') AND cd.exception_type = 2
    )
  UNION
  SELECT cd.service_id FROM calendar_dates cd, d
  WHERE cd.date = to_char(d.today, 'YYYYMMDD') AND cd.exception_type = 1;
$$;

-- Routes serving a stop today (used for the manual connecting-route fallback).
CREATE OR REPLACE FUNCTION public.routes_serving_stop(p_stop_id text)
RETURNS TABLE(route_id text, route_short_name text, route_long_name text, route_type integer, sample_headsign text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT r.route_id, r.route_short_name, r.route_long_name, r.route_type,
         min(t.trip_headsign) AS sample_headsign
  FROM stop_times st
  JOIN trips t ON t.trip_id = st.trip_id
  JOIN routes r ON r.route_id = t.route_id
  WHERE st.stop_id = p_stop_id
    AND t.service_id IN (SELECT s.service_id FROM active_service_ids() s)
  GROUP BY r.route_id, r.route_short_name, r.route_long_name, r.route_type
  ORDER BY r.route_type, r.route_short_name;
$$;

-- Rail departures from a station today, on or after a given seconds-after-midnight.
-- Re-runnable: a later migration changes this function's return type.
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc
    WHERE proname = 'rail_departures' AND pronamespace = 'public'::regnamespace
  LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.rail_departures(
  p_home_stop text, p_after_seconds integer DEFAULT NULL, p_limit integer DEFAULT 4
)
RETURNS TABLE(
  trip_id text, route_id text, route_long_name text, route_short_name text,
  trip_headsign text, stop_name text, departure_time text, departure_seconds integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT t.trip_id, r.route_id, r.route_long_name, r.route_short_name,
         t.trip_headsign, s.stop_name, st.departure_time, gtfs_seconds(st.departure_time)
  FROM stop_times st
  JOIN trips t ON t.trip_id = st.trip_id
  JOIN routes r ON r.route_id = t.route_id
  JOIN stops s ON s.stop_id = st.stop_id
  WHERE st.stop_id = p_home_stop
    AND r.route_type = 1
    AND t.service_id IN (SELECT a.service_id FROM active_service_ids() a)
    AND gtfs_seconds(st.departure_time) >= coalesce(
      p_after_seconds,
      extract(hour FROM now() AT TIME ZONE 'Pacific/Honolulu')::int * 3600
        + extract(minute FROM now() AT TIME ZONE 'Pacific/Honolulu')::int * 60
    )
  ORDER BY gtfs_seconds(st.departure_time)
  LIMIT p_limit;
$$;

-- Full chained trip: rail from home station -> transfer station -> connecting bus to destination stop.
CREATE OR REPLACE FUNCTION public.plan_rail_chains(
  p_home_stop text,
  p_dest_stop text,
  p_after_seconds integer DEFAULT NULL,
  p_limit integer DEFAULT 4,
  p_bus_route_id text DEFAULT NULL,
  p_transfer_buffer_seconds integer DEFAULT 240,
  p_transfer_radius_m integer DEFAULT 700
)
RETURNS TABLE(
  rail_trip_id text,
  rail_route_long_name text,
  rail_route_short_name text,
  rail_headsign text,
  home_stop_name text,
  depart_time text,
  depart_seconds integer,
  transfer_stop_id text,
  transfer_stop_name text,
  rail_arrive_time text,
  rail_arrive_seconds integer,
  bus_route_id text,
  bus_route_short_name text,
  bus_route_long_name text,
  bus_headsign text,
  bus_stop_name text,
  bus_depart_time text,
  bus_depart_seconds integer,
  dest_stop_name text,
  arrive_time text,
  arrive_seconds integer,
  total_minutes integer
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_after integer := coalesce(
    p_after_seconds,
    extract(hour FROM now() AT TIME ZONE 'Pacific/Honolulu')::int * 3600
      + extract(minute FROM now() AT TIME ZONE 'Pacific/Honolulu')::int * 60
  );
BEGIN
  RETURN QUERY
  WITH active AS (SELECT a.service_id FROM active_service_ids() a),
  stations AS (SELECT * FROM rail_stations()),
  dest_routes AS (
    SELECT DISTINCT r.route_id
    FROM stop_times st
    JOIN trips t ON t.trip_id = st.trip_id
    JOIN routes r ON r.route_id = t.route_id
    WHERE st.stop_id = p_dest_stop
      AND r.route_type <> 1
      AND t.service_id IN (SELECT service_id FROM active)
      AND (p_bus_route_id IS NULL OR r.route_id = p_bus_route_id)
  ),
  dest_route_stops AS (
    SELECT DISTINCT st.stop_id, s.stop_lat, s.stop_lon
    FROM trips t
    JOIN stop_times st ON st.trip_id = t.trip_id
    JOIN stops s ON s.stop_id = st.stop_id
    WHERE t.route_id IN (SELECT route_id FROM dest_routes)
      AND t.service_id IN (SELECT service_id FROM active)
  ),
  links AS (
    SELECT DISTINCT stn.stop_id AS rail_stop, drs.stop_id AS bus_stop
    FROM stations stn
    JOIN dest_route_stops drs
      ON gtfs_distance_m(stn.stop_lat, stn.stop_lon, drs.stop_lat, drs.stop_lon) <= p_transfer_radius_m
  ),
  departures AS (
    SELECT st.trip_id, st.stop_sequence, st.departure_time,
           gtfs_seconds(st.departure_time) AS dep_sec,
           r.route_long_name, r.route_short_name, t.trip_headsign, s.stop_name
    FROM stop_times st
    JOIN trips t ON t.trip_id = st.trip_id
    JOIN routes r ON r.route_id = t.route_id
    JOIN stops s ON s.stop_id = st.stop_id
    WHERE st.stop_id = p_home_stop
      AND r.route_type = 1
      AND t.service_id IN (SELECT service_id FROM active)
      AND gtfs_seconds(st.departure_time) >= v_after
    ORDER BY gtfs_seconds(st.departure_time)
    LIMIT 25
  ),
  arrivals AS (
    SELECT d.*, a.stop_id AS xfer_stop, a.arrival_time AS xfer_time,
           gtfs_seconds(a.arrival_time) AS xfer_sec
    FROM departures d
    JOIN stop_times a ON a.trip_id = d.trip_id AND a.stop_sequence > d.stop_sequence
    WHERE a.stop_id IN (SELECT rail_stop FROM links)
  ),
  chained AS (
    SELECT ar.*, leg.*
    FROM arrivals ar
    CROSS JOIN LATERAL (
      SELECT r2.route_id AS b_route_id, r2.route_short_name AS b_short, r2.route_long_name AS b_long,
             t2.trip_headsign AS b_headsign, bs.stop_name AS b_stop_name,
             b.departure_time AS b_dep_time, gtfs_seconds(b.departure_time) AS b_dep_sec,
             dst.arrival_time AS b_arr_time, gtfs_seconds(dst.arrival_time) AS b_arr_sec
      FROM links l
      JOIN stops bs ON bs.stop_id = l.bus_stop
      JOIN stop_times b ON b.stop_id = l.bus_stop
      JOIN trips t2 ON t2.trip_id = b.trip_id
      JOIN routes r2 ON r2.route_id = t2.route_id
      JOIN stop_times dst ON dst.trip_id = b.trip_id AND dst.stop_id = p_dest_stop
                         AND dst.stop_sequence > b.stop_sequence
      WHERE l.rail_stop = ar.xfer_stop
        AND t2.route_id IN (SELECT route_id FROM dest_routes)
        AND t2.service_id IN (SELECT service_id FROM active)
        AND gtfs_seconds(b.departure_time) >= ar.xfer_sec + p_transfer_buffer_seconds
      ORDER BY gtfs_seconds(dst.arrival_time), gtfs_seconds(b.departure_time)
      LIMIT 1
    ) leg
  ),
  best AS (
    SELECT DISTINCT ON (dep_sec) *
    FROM chained
    ORDER BY dep_sec, b_arr_sec
  )
  SELECT b.trip_id, b.route_long_name, b.route_short_name, b.trip_headsign, b.stop_name,
         b.departure_time, b.dep_sec,
         b.xfer_stop, xs.stop_name, b.xfer_time, b.xfer_sec,
         b.b_route_id, b.b_short, b.b_long, b.b_headsign, b.b_stop_name,
         b.b_dep_time, b.b_dep_sec,
         ds.stop_name, b.b_arr_time, b.b_arr_sec,
         ((b.b_arr_sec - b.dep_sec) / 60)::int
  FROM best b
  JOIN stops xs ON xs.stop_id = b.xfer_stop
  JOIN stops ds ON ds.stop_id = p_dest_stop
  ORDER BY b.dep_sec
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gtfs_seconds(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gtfs_distance_m(numeric, numeric, numeric, numeric) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rail_stations() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.nearest_stop(numeric, numeric, boolean) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.active_service_ids() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.routes_serving_stop(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rail_departures(text, integer, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.plan_rail_chains(text, text, integer, integer, text, integer, integer) TO anon, authenticated, service_role;
-- Restore the original chain helper, with the transfer radius widened to 0.75 mile
-- and any transfer walk over a quarter mile counted in the connection wait.
CREATE OR REPLACE FUNCTION public.plan_rail_chains(
  p_home_stop text,
  p_dest_stop text,
  p_after_seconds integer DEFAULT NULL,
  p_limit integer DEFAULT 4,
  p_bus_route_id text DEFAULT NULL,
  p_transfer_buffer_seconds integer DEFAULT 240,
  p_transfer_radius_m integer DEFAULT 1207
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
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH v AS MATERIALIZED (
    SELECT coalesce(
      p_after_seconds,
      extract(hour FROM now() AT TIME ZONE 'Pacific/Honolulu')::int * 3600
        + extract(minute FROM now() AT TIME ZONE 'Pacific/Honolulu')::int * 60
    ) AS after_sec
  ),
  active AS MATERIALIZED (
    SELECT DISTINCT a.service_id FROM active_service_ids() a
  ),
  dest_routes AS MATERIALIZED (
    SELECT DISTINCT r.route_id
    FROM stop_times st
    JOIN trips t ON t.trip_id = st.trip_id
    JOIN routes r ON r.route_id = t.route_id
    WHERE st.stop_id = p_dest_stop
      AND r.route_type <> 1
      AND t.service_id IN (SELECT service_id FROM active)
      AND (p_bus_route_id IS NULL OR r.route_id = p_bus_route_id)
  ),
  near AS MATERIALIZED (
    SELECT stn.stop_id AS rail_stop, s.stop_id AS bus_stop,
           min(gtfs_distance_m(stn.stop_lat, stn.stop_lon, s.stop_lat, s.stop_lon)) AS dist_m
    FROM rail_stations() stn
    JOIN stops s
      ON s.stop_lat BETWEEN stn.stop_lat - 0.02 AND stn.stop_lat + 0.02
     AND s.stop_lon BETWEEN stn.stop_lon - 0.02 AND stn.stop_lon + 0.02
     AND gtfs_distance_m(stn.stop_lat, stn.stop_lon, s.stop_lat, s.stop_lon) <= p_transfer_radius_m
    GROUP BY stn.stop_id, s.stop_id
  ),
  links AS MATERIALIZED (
    SELECT n.rail_stop, n.bus_stop,
           CASE WHEN n.dist_m > 402 THEN (ceil(n.dist_m / 80.47) * 60)::int ELSE 0 END AS walk_sec
    FROM near n
    WHERE EXISTS (
      SELECT 1 FROM stop_times st
      JOIN trips t ON t.trip_id = st.trip_id
      WHERE st.stop_id = n.bus_stop
        AND t.route_id IN (SELECT route_id FROM dest_routes)
        AND t.service_id IN (SELECT service_id FROM active)
    )
  ),
  departures AS MATERIALIZED (
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
      AND gtfs_seconds(st.departure_time) >= (SELECT after_sec FROM v)
    ORDER BY gtfs_seconds(st.departure_time)
    LIMIT 12
  ),
  arrivals AS MATERIALIZED (
    SELECT d.*, a.stop_id AS xfer_stop, a.arrival_time AS xfer_time,
           gtfs_seconds(a.arrival_time) AS xfer_sec
    FROM departures d
    JOIN stop_times a ON a.trip_id = d.trip_id AND a.stop_sequence > d.stop_sequence
    WHERE a.stop_id IN (SELECT DISTINCT rail_stop FROM links)
  ),
  chained AS MATERIALIZED (
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
        AND gtfs_seconds(b.departure_time) >= ar.xfer_sec + p_transfer_buffer_seconds + l.walk_sec
      ORDER BY gtfs_seconds(dst.arrival_time), gtfs_seconds(b.departure_time)
      LIMIT 1
    ) leg
  ),
  best AS (
    SELECT DISTINCT ON (dep_sec) * FROM chained ORDER BY dep_sec, b_arr_sec
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
$$;

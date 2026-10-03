CREATE OR REPLACE FUNCTION public.nearby_stops(p_lat numeric, p_lon numeric, p_radius_m integer)
RETURNS TABLE(stop_id text, stop_name text, stop_lat numeric, stop_lon numeric, distance_m double precision)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH b AS (
    SELECT p_lat::double precision AS lat, p_lon::double precision AS lon,
           p_radius_m / 111000.0 AS dlat,
           p_radius_m / (111000.0 * greatest(cos(radians(p_lat::double precision)), 0.2)) AS dlon
  )
  SELECT s.stop_id, s.stop_name, s.stop_lat, s.stop_lon,
         gtfs_distance_m(p_lat, p_lon, s.stop_lat, s.stop_lon) AS distance_m
  FROM stops s, b
  WHERE s.stop_lat IS NOT NULL AND s.stop_lon IS NOT NULL
    AND s.stop_lat::double precision BETWEEN b.lat - b.dlat AND b.lat + b.dlat
    AND s.stop_lon::double precision BETWEEN b.lon - b.dlon AND b.lon + b.dlon
    AND gtfs_distance_m(p_lat, p_lon, s.stop_lat, s.stop_lon) <= p_radius_m
  ORDER BY distance_m;
$$;

-- Walk / drive / feeder-bus options from a point to a rail station (or to any rail station).
-- Re-runnable: a later migration changes this function's return type.
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc
    WHERE proname = 'access_legs' AND pronamespace = 'public'::regnamespace
  LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.access_legs(
  p_lat numeric,
  p_lon numeric,
  p_station text DEFAULT NULL,
  p_allow_drive boolean DEFAULT false,
  p_earliest integer DEFAULT 0,
  p_window_sec integer DEFAULT 10800,
  p_walk_radius_m integer DEFAULT 1250,
  p_board_radius_m integer DEFAULT 800,
  p_station_radius_m integer DEFAULT 400
)
RETURNS TABLE(
  mode text, station_stop text, station_name text,
  route_id text, route_short_name text, route_long_name text, headsign text,
  from_stop_name text, to_stop_name text,
  board_seconds integer, arrive_seconds integer, leave_by_seconds integer, minutes integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH stations AS MATERIALIZED (
    SELECT rs.stop_id, rs.stop_name, rs.stop_lat, rs.stop_lon,
           gtfs_distance_m(p_lat, p_lon, rs.stop_lat, rs.stop_lon) AS dist
    FROM rail_stations() rs
    WHERE p_station IS NULL OR rs.stop_id = p_station
  ),
  active AS MATERIALIZED (SELECT DISTINCT a.service_id FROM active_service_ids() a),
  flexible AS (
    SELECT 'walk'::text AS mode, s.stop_id, s.stop_name, NULL::text AS route_id,
           NULL::text AS rshort, NULL::text AS rlong, NULL::text AS headsign,
           'Your location'::text AS from_name, s.stop_name AS to_name,
           NULL::integer AS board_sec, NULL::integer AS arrive_sec, NULL::integer AS leave_sec,
           ceil(s.dist / 83.33)::integer AS minutes
    FROM stations s
    WHERE s.dist <= p_walk_radius_m
    UNION ALL
    SELECT 'drive', s.stop_id, s.stop_name, NULL, NULL, NULL, NULL,
           'Your location', s.stop_name, NULL, NULL, NULL,
           (ceil(s.dist / 500.0) + 3)::integer
    FROM stations s
    WHERE p_allow_drive AND s.dist <= 40000
  ),
  board AS MATERIALIZED (
    SELECT n.stop_id, n.stop_name, ceil(n.distance_m / 83.33)::integer AS walk_min
    FROM nearby_stops(p_lat, p_lon, p_board_radius_m) n
  ),
  target AS MATERIALIZED (
    SELECT s.stop_id AS station_stop, s.stop_name AS station_name,
           ns.stop_id AS near_stop, ceil(ns.distance_m / 83.33)::integer AS walk_min
    FROM stations s
    CROSS JOIN LATERAL nearby_stops(s.stop_lat, s.stop_lon, p_station_radius_m) ns
  ),
  busleg AS (
    SELECT 'bus'::text AS mode, tg.station_stop, tg.station_name, r.route_id,
           r.route_short_name, r.route_long_name, tp.trip_headsign,
           bd.stop_name AS from_name, tg.station_name AS to_name,
           gtfs_seconds(b.departure_time) AS board_sec,
           gtfs_seconds(a.arrival_time) + tg.walk_min * 60 AS arrive_sec,
           gtfs_seconds(b.departure_time) - bd.walk_min * 60 AS leave_sec,
           ((gtfs_seconds(a.arrival_time) - gtfs_seconds(b.departure_time)) / 60
             + bd.walk_min + tg.walk_min)::integer AS minutes
    FROM board bd
    JOIN stop_times b ON b.stop_id = bd.stop_id
    JOIN trips tp ON tp.trip_id = b.trip_id
    JOIN routes r ON r.route_id = tp.route_id AND r.route_type <> 1
    JOIN stop_times a ON a.trip_id = b.trip_id AND a.stop_sequence > b.stop_sequence
    JOIN target tg ON tg.near_stop = a.stop_id
    WHERE tp.service_id IN (SELECT service_id FROM active)
      AND gtfs_seconds(b.departure_time) >= p_earliest + bd.walk_min * 60
      AND gtfs_seconds(b.departure_time) <= p_earliest + p_window_sec
  )
  SELECT mode, stop_id, stop_name, route_id, rshort, rlong, headsign,
         from_name, to_name, board_sec, arrive_sec, leave_sec, minutes
  FROM flexible
  UNION ALL
  SELECT mode, station_stop, station_name, route_id, route_short_name, route_long_name, trip_headsign,
         from_name, to_name, board_sec, arrive_sec, leave_sec, minutes
  FROM busleg;
$$;

-- Walk / drive / bus options from a rail station to a point.
-- Re-runnable: a later migration changes this function's return type.
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc
    WHERE proname = 'egress_legs' AND pronamespace = 'public'::regnamespace
  LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.egress_legs(
  p_station text,
  p_lat numeric,
  p_lon numeric,
  p_allow_drive boolean DEFAULT false,
  p_earliest integer DEFAULT 0,
  p_window_sec integer DEFAULT 7200,
  p_walk_radius_m integer DEFAULT 1250,
  p_point_radius_m integer DEFAULT 800,
  p_station_radius_m integer DEFAULT 400
)
RETURNS TABLE(
  mode text, route_id text, route_short_name text, route_long_name text, headsign text,
  from_stop_name text, to_stop_name text,
  board_seconds integer, arrive_seconds integer, minutes integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH st AS MATERIALIZED (
    SELECT s.stop_id, s.stop_name, s.stop_lat, s.stop_lon,
           gtfs_distance_m(p_lat, p_lon, s.stop_lat, s.stop_lon) AS dist
    FROM stops s WHERE s.stop_id = p_station
  ),
  active AS MATERIALIZED (SELECT DISTINCT a.service_id FROM active_service_ids() a),
  flexible AS (
    SELECT 'walk'::text AS mode, NULL::text AS route_id, NULL::text AS rshort, NULL::text AS rlong,
           NULL::text AS headsign, st.stop_name AS from_name, 'Your destination'::text AS to_name,
           NULL::integer AS board_sec, NULL::integer AS arrive_sec,
           ceil(st.dist / 83.33)::integer AS minutes
    FROM st WHERE st.dist <= p_walk_radius_m
    UNION ALL
    SELECT 'drive', NULL, NULL, NULL, NULL, st.stop_name, 'Your destination', NULL, NULL,
           (ceil(st.dist / 500.0) + 3)::integer
    FROM st WHERE p_allow_drive AND st.dist <= 40000
  ),
  board AS MATERIALIZED (
    SELECT ns.stop_id, ns.stop_name, ceil(ns.distance_m / 83.33)::integer AS walk_min
    FROM st CROSS JOIN LATERAL nearby_stops(st.stop_lat, st.stop_lon, p_station_radius_m) ns
  ),
  arrive AS MATERIALIZED (
    SELECT n.stop_id, n.stop_name, ceil(n.distance_m / 83.33)::integer AS walk_min
    FROM nearby_stops(p_lat, p_lon, p_point_radius_m) n
  ),
  busleg AS (
    SELECT 'bus'::text AS mode, r.route_id, r.route_short_name, r.route_long_name, tp.trip_headsign,
           bd.stop_name AS from_name, ar.stop_name AS to_name,
           gtfs_seconds(b.departure_time) AS board_sec,
           gtfs_seconds(a.arrival_time) + ar.walk_min * 60 AS arrive_sec,
           ((gtfs_seconds(a.arrival_time) - gtfs_seconds(b.departure_time)) / 60
             + bd.walk_min + ar.walk_min)::integer AS minutes
    FROM board bd
    JOIN stop_times b ON b.stop_id = bd.stop_id
    JOIN trips tp ON tp.trip_id = b.trip_id
    JOIN routes r ON r.route_id = tp.route_id AND r.route_type <> 1
    JOIN stop_times a ON a.trip_id = b.trip_id AND a.stop_sequence > b.stop_sequence
    JOIN arrive ar ON ar.stop_id = a.stop_id
    WHERE tp.service_id IN (SELECT service_id FROM active)
      AND gtfs_seconds(b.departure_time) >= p_earliest + bd.walk_min * 60
      AND gtfs_seconds(b.departure_time) <= p_earliest + p_window_sec
  )
  SELECT mode, route_id, rshort, rlong, headsign, from_name, to_name, board_sec, arrive_sec, minutes FROM flexible
  UNION ALL
  SELECT mode, route_id, route_short_name, route_long_name, trip_headsign, from_name, to_name, board_sec, arrive_sec, minutes FROM busleg;
$$;

-- Service hours per ISO day of week for a stop, optionally limited to a route type.
CREATE OR REPLACE FUNCTION public.service_hours(p_stop_id text, p_route_type integer DEFAULT NULL)
RETURNS TABLE(dow integer, first_seconds integer, last_seconds integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH svc AS (
    SELECT c.service_id, d.dow
    FROM calendar c
    CROSS JOIN (VALUES (1),(2),(3),(4),(5),(6),(7)) AS d(dow)
    WHERE CASE d.dow
            WHEN 1 THEN c.monday WHEN 2 THEN c.tuesday WHEN 3 THEN c.wednesday
            WHEN 4 THEN c.thursday WHEN 5 THEN c.friday WHEN 6 THEN c.saturday
            ELSE c.sunday END = 1
  )
  SELECT svc.dow,
         min(gtfs_seconds(st.departure_time))::integer,
         max(gtfs_seconds(st.departure_time))::integer
  FROM stop_times st
  JOIN trips t ON t.trip_id = st.trip_id
  JOIN routes r ON r.route_id = t.route_id
  JOIN svc ON svc.service_id = t.service_id
  WHERE st.stop_id = p_stop_id
    AND (p_route_type IS NULL OR r.route_type = p_route_type)
  GROUP BY svc.dow
  ORDER BY svc.dow;
$$;

-- Outbound: point -> (walk/drive/feeder bus) -> rail -> connecting bus -> destination stop.
-- Re-runnable: a later migration changes this function's return type.
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc
    WHERE proname = 'plan_outbound' AND pronamespace = 'public'::regnamespace
  LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.plan_outbound(
  p_origin_lat numeric,
  p_origin_lon numeric,
  p_station text,
  p_dest_stop text,
  p_allow_drive boolean DEFAULT false,
  p_after_seconds integer DEFAULT NULL,
  p_limit integer DEFAULT 4,
  p_bus_route_id text DEFAULT NULL,
  p_transfer_buffer_seconds integer DEFAULT 240,
  p_transfer_radius_m integer DEFAULT 700
)
RETURNS TABLE(
  leave_by_seconds integer,
  depart_seconds integer,
  arrive_seconds integer,
  total_minutes integer,
  rail_trip_id text,
  legs jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH v AS MATERIALIZED (
    SELECT coalesce(
      p_after_seconds,
      extract(hour FROM now() AT TIME ZONE 'Pacific/Honolulu')::int * 3600
        + extract(minute FROM now() AT TIME ZONE 'Pacific/Honolulu')::int * 60
    ) AS after_sec
  ),
  active AS MATERIALIZED (SELECT DISTINCT a.service_id FROM active_service_ids() a),
  acc AS MATERIALIZED (
    SELECT a.*,
           CASE WHEN a.arrive_seconds IS NULL
                THEN (SELECT after_sec FROM v) + a.minutes * 60
                ELSE a.arrive_seconds + 120 END AS ready_sec
    FROM access_legs(p_origin_lat, p_origin_lon, p_station, p_allow_drive,
                     (SELECT after_sec FROM v)) a
  ),
  ready AS MATERIALIZED (SELECT min(ready_sec) AS ready_sec FROM acc),
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
    SELECT DISTINCT stn.stop_id AS rail_stop, s.stop_id AS bus_stop
    FROM rail_stations() stn
    JOIN stops s
      ON s.stop_lat BETWEEN stn.stop_lat - 0.01 AND stn.stop_lat + 0.01
     AND s.stop_lon BETWEEN stn.stop_lon - 0.01 AND stn.stop_lon + 0.01
     AND gtfs_distance_m(stn.stop_lat, stn.stop_lon, s.stop_lat, s.stop_lon) <= p_transfer_radius_m
  ),
  links AS MATERIALIZED (
    SELECT n.rail_stop, n.bus_stop
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
    SELECT st.trip_id, st.stop_sequence, gtfs_seconds(st.departure_time) AS dep_sec,
           r.route_long_name, r.route_short_name, t.trip_headsign, s.stop_name
    FROM stop_times st
    JOIN trips t ON t.trip_id = st.trip_id
    JOIN routes r ON r.route_id = t.route_id
    JOIN stops s ON s.stop_id = st.stop_id
    WHERE st.stop_id = p_station
      AND r.route_type = 1
      AND t.service_id IN (SELECT service_id FROM active)
      AND gtfs_seconds(st.departure_time) >= (SELECT ready_sec FROM ready)
    ORDER BY gtfs_seconds(st.departure_time)
    LIMIT 16
  ),
  arrivals AS MATERIALIZED (
    SELECT d.*, a.stop_id AS xfer_stop, gtfs_seconds(a.arrival_time) AS xfer_sec
    FROM departures d
    JOIN stop_times a ON a.trip_id = d.trip_id AND a.stop_sequence > d.stop_sequence
    WHERE a.stop_id IN (SELECT DISTINCT rail_stop FROM links)
  ),
  chained AS MATERIALIZED (
    SELECT ar.*, leg.*
    FROM arrivals ar
    CROSS JOIN LATERAL (
      SELECT r2.route_short_name AS b_short, r2.route_long_name AS b_long,
             t2.trip_headsign AS b_headsign, bs.stop_name AS b_stop_name,
             gtfs_seconds(b.departure_time) AS b_dep_sec,
             gtfs_seconds(dst.arrival_time) AS b_arr_sec
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
    SELECT DISTINCT ON (dep_sec) * FROM chained ORDER BY dep_sec, b_arr_sec
  ),
  withaccess AS (
    SELECT b.*, pick.*
    FROM best b
    CROSS JOIN LATERAL (
      SELECT a.mode AS a_mode, a.route_short_name AS a_short, a.route_long_name AS a_long,
             a.headsign AS a_headsign, a.from_stop_name AS a_from, a.to_stop_name AS a_to,
             a.minutes AS a_minutes, a.board_seconds AS a_board,
             CASE WHEN a.arrive_seconds IS NULL THEN b.dep_sec - a.minutes * 60
                  ELSE a.leave_by_seconds END AS a_leave_by,
             CASE WHEN a.arrive_seconds IS NULL THEN b.dep_sec ELSE a.arrive_seconds END AS a_arrive
      FROM acc a
      WHERE a.ready_sec <= b.dep_sec
      ORDER BY CASE WHEN a.arrive_seconds IS NULL THEN b.dep_sec - a.minutes * 60
                    ELSE a.leave_by_seconds END DESC,
               a.minutes
      LIMIT 1
    ) pick
  )
  SELECT w.a_leave_by, w.dep_sec, w.b_arr_sec,
         ((w.b_arr_sec - w.a_leave_by) / 60)::int,
         w.trip_id,
         jsonb_build_array(
           jsonb_build_object('kind','access','mode',w.a_mode,'route_short',w.a_short,
             'route_long',w.a_long,'headsign',w.a_headsign,'from',w.a_from,'to',w.a_to,
             'depart_seconds',coalesce(w.a_board, w.a_leave_by),'arrive_seconds',w.a_arrive,'minutes',w.a_minutes),
           jsonb_build_object('kind','rail','mode','rail','route_short',w.route_short_name,
             'route_long',w.route_long_name,'headsign',w.trip_headsign,'from',w.stop_name,
             'to',(SELECT stop_name FROM stops WHERE stop_id = w.xfer_stop),
             'depart_seconds',w.dep_sec,'arrive_seconds',w.xfer_sec,
             'minutes',((w.xfer_sec - w.dep_sec)/60)::int),
           jsonb_build_object('kind','connect','mode','bus','route_short',w.b_short,
             'route_long',w.b_long,'headsign',w.b_headsign,'from',w.b_stop_name,
             'to',(SELECT stop_name FROM stops WHERE stop_id = p_dest_stop),
             'depart_seconds',w.b_dep_sec,'arrive_seconds',w.b_arr_sec,
             'minutes',((w.b_arr_sec - w.b_dep_sec)/60)::int)
         )
  FROM withaccess w
  ORDER BY w.a_leave_by
  LIMIT p_limit;
$$;

-- Inbound: destination point -> (walk/feeder bus) -> rail -> home station -> (walk/drive/bus) -> home point.
CREATE OR REPLACE FUNCTION public.plan_inbound(
  p_dest_lat numeric,
  p_dest_lon numeric,
  p_station text,
  p_home_lat numeric,
  p_home_lon numeric,
  p_allow_drive boolean DEFAULT false,
  p_after_seconds integer DEFAULT NULL,
  p_limit integer DEFAULT 4,
  p_transfer_buffer_seconds integer DEFAULT 240
)
RETURNS TABLE(
  leave_by_seconds integer,
  depart_seconds integer,
  arrive_seconds integer,
  total_minutes integer,
  rail_trip_id text,
  legs jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH v AS MATERIALIZED (
    SELECT coalesce(
      p_after_seconds,
      extract(hour FROM now() AT TIME ZONE 'Pacific/Honolulu')::int * 3600
        + extract(minute FROM now() AT TIME ZONE 'Pacific/Honolulu')::int * 60
    ) AS after_sec
  ),
  active AS MATERIALIZED (SELECT DISTINCT a.service_id FROM active_service_ids() a),
  acc AS MATERIALIZED (
    SELECT a.*,
           CASE WHEN a.arrive_seconds IS NULL
                THEN (SELECT after_sec FROM v) + a.minutes * 60
                ELSE a.arrive_seconds + 120 END AS ready_sec
    FROM access_legs(p_dest_lat, p_dest_lon, NULL, false, (SELECT after_sec FROM v)) a
    WHERE a.station_stop <> p_station
  ),
  stations AS MATERIALIZED (
    SELECT station_stop, min(ready_sec) AS ready_sec FROM acc GROUP BY station_stop
  ),
  rides AS MATERIALIZED (
    SELECT s.station_stop, ride.*
    FROM stations s
    CROSS JOIN LATERAL (
      SELECT st.trip_id, gtfs_seconds(st.departure_time) AS dep_sec,
             gtfs_seconds(hm.arrival_time) AS arr_sec,
             r.route_long_name, r.route_short_name, t.trip_headsign,
             bo.stop_name AS board_name, ho.stop_name AS alight_name
      FROM stop_times st
      JOIN trips t ON t.trip_id = st.trip_id
      JOIN routes r ON r.route_id = t.route_id AND r.route_type = 1
      JOIN stop_times hm ON hm.trip_id = st.trip_id AND hm.stop_id = p_station
                        AND hm.stop_sequence > st.stop_sequence
      JOIN stops bo ON bo.stop_id = st.stop_id
      JOIN stops ho ON ho.stop_id = p_station
      WHERE st.stop_id = s.station_stop
        AND t.service_id IN (SELECT service_id FROM active)
        AND gtfs_seconds(st.departure_time) >= s.ready_sec
      ORDER BY gtfs_seconds(st.departure_time)
      LIMIT 6
    ) ride
  ),
  withlegs AS (
    SELECT r.*, a.*, e.*
    FROM rides r
    CROSS JOIN LATERAL (
      SELECT ac.mode AS a_mode, ac.route_short_name AS a_short, ac.route_long_name AS a_long,
             ac.headsign AS a_headsign, ac.from_stop_name AS a_from, ac.to_stop_name AS a_to,
             ac.minutes AS a_minutes, ac.board_seconds AS a_board,
             CASE WHEN ac.arrive_seconds IS NULL THEN r.dep_sec - ac.minutes * 60
                  ELSE ac.leave_by_seconds END AS a_leave_by,
             CASE WHEN ac.arrive_seconds IS NULL THEN r.dep_sec ELSE ac.arrive_seconds END AS a_arrive
      FROM acc ac
      WHERE ac.station_stop = r.station_stop AND ac.ready_sec <= r.dep_sec
      ORDER BY CASE WHEN ac.arrive_seconds IS NULL THEN r.dep_sec - ac.minutes * 60
                    ELSE ac.leave_by_seconds END DESC,
               ac.minutes
      LIMIT 1
    ) a
    CROSS JOIN LATERAL (
      SELECT eg.mode AS e_mode, eg.route_short_name AS e_short, eg.route_long_name AS e_long,
             eg.headsign AS e_headsign, eg.from_stop_name AS e_from, eg.to_stop_name AS e_to,
             eg.minutes AS e_minutes,
             coalesce(eg.board_seconds, r.arr_sec) AS e_depart,
             coalesce(eg.arrive_seconds, r.arr_sec + eg.minutes * 60) AS e_arrive
      FROM egress_legs(p_station, p_home_lat, p_home_lon, p_allow_drive, r.arr_sec) eg
      WHERE eg.arrive_seconds IS NULL
         OR eg.board_seconds >= r.arr_sec + p_transfer_buffer_seconds
      ORDER BY coalesce(eg.arrive_seconds, r.arr_sec + eg.minutes * 60)
      LIMIT 1
    ) e
  ),
  best AS (
    SELECT DISTINCT ON (a_leave_by) * FROM withlegs ORDER BY a_leave_by, e_arrive
  )
  SELECT w.a_leave_by, w.dep_sec, w.e_arrive,
         ((w.e_arrive - w.a_leave_by) / 60)::int,
         w.trip_id,
         jsonb_build_array(
           jsonb_build_object('kind','access','mode',w.a_mode,'route_short',w.a_short,
             'route_long',w.a_long,'headsign',w.a_headsign,'from',w.a_from,'to',w.a_to,
             'depart_seconds',coalesce(w.a_board, w.a_leave_by),'arrive_seconds',w.a_arrive,'minutes',w.a_minutes),
           jsonb_build_object('kind','rail','mode','rail','route_short',w.route_short_name,
             'route_long',w.route_long_name,'headsign',w.trip_headsign,'from',w.board_name,
             'to',w.alight_name,'depart_seconds',w.dep_sec,'arrive_seconds',w.arr_sec,
             'minutes',((w.arr_sec - w.dep_sec)/60)::int),
           jsonb_build_object('kind','egress','mode',w.e_mode,'route_short',w.e_short,
             'route_long',w.e_long,'headsign',w.e_headsign,'from',w.e_from,'to',w.e_to,
             'depart_seconds',w.e_depart,'arrive_seconds',w.e_arrive,'minutes',w.e_minutes)
         )
  FROM best w
  ORDER BY w.a_leave_by
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.nearby_stops(numeric, numeric, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.access_legs(numeric, numeric, text, boolean, integer, integer, integer, integer, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.egress_legs(text, numeric, numeric, boolean, integer, integer, integer, integer, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.service_hours(text, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.plan_outbound(numeric, numeric, text, text, boolean, integer, integer, text, integer, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.plan_inbound(numeric, numeric, text, numeric, numeric, boolean, integer, integer, integer) TO anon, authenticated, service_role;
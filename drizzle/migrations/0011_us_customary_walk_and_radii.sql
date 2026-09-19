-- US customary assumptions: walking 3 mph (80.47 m/min), driving 25 mph (670.6 m/min),
-- walk limit 15 min = 0.75 mile (1207 m), bus board radius 0.5 mile (805 m),
-- stop-to-station proximity a quarter mile (402 m), transfer walk 0.5 mile (805 m).
CREATE OR REPLACE FUNCTION public.access_legs(
  p_lat numeric,
  p_lon numeric,
  p_station text DEFAULT NULL,
  p_allow_drive boolean DEFAULT false,
  p_earliest integer DEFAULT 0,
  p_window_sec integer DEFAULT 10800,
  p_walk_radius_m integer DEFAULT 1207,
  p_board_radius_m integer DEFAULT 805,
  p_station_radius_m integer DEFAULT 402
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
           ceil(s.dist / 80.47)::integer AS minutes
    FROM stations s
    WHERE s.dist <= p_walk_radius_m
    UNION ALL
    SELECT 'drive', s.stop_id, s.stop_name, NULL, NULL, NULL, NULL,
           'Your location', s.stop_name, NULL, NULL, NULL,
           (ceil(s.dist / 670.6) + 3)::integer
    FROM stations s
    WHERE p_allow_drive AND s.dist <= 64374
  ),
  board AS MATERIALIZED (
    SELECT n.stop_id, n.stop_name, ceil(n.distance_m / 80.47)::integer AS walk_min
    FROM nearby_stops(p_lat, p_lon, p_board_radius_m) n
  ),
  target AS MATERIALIZED (
    SELECT s.stop_id AS station_stop, s.stop_name AS station_name,
           ns.stop_id AS near_stop, min(ceil(ns.distance_m / 80.47))::integer AS walk_min
    FROM stations s
    CROSS JOIN LATERAL nearby_stops(s.stop_lat, s.stop_lon, p_station_radius_m) ns
    GROUP BY s.stop_id, s.stop_name, ns.stop_id
  ),
  station_routes AS MATERIALIZED (
    SELECT DISTINCT t.route_id
    FROM target tg
    JOIN stop_times st ON st.stop_id = tg.near_stop
    JOIN trips t ON t.trip_id = st.trip_id
    JOIN routes r ON r.route_id = t.route_id AND r.route_type <> 1
    WHERE t.service_id IN (SELECT service_id FROM active)
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
    JOIN routes r ON r.route_id = tp.route_id
    JOIN stop_times a ON a.trip_id = b.trip_id AND a.stop_sequence > b.stop_sequence
    JOIN target tg ON tg.near_stop = a.stop_id
    WHERE tp.route_id IN (SELECT route_id FROM station_routes)
      AND tp.service_id IN (SELECT service_id FROM active)
      AND gtfs_seconds(b.departure_time) >= p_earliest + bd.walk_min * 60
      AND gtfs_seconds(b.departure_time) <= p_earliest + p_window_sec
  )
  SELECT mode, stop_id, stop_name, route_id, rshort, rlong, headsign,
         from_name, to_name, board_sec, arrive_sec, leave_sec, minutes
  FROM flexible
  UNION ALL
  SELECT DISTINCT ON (station_stop, route_id, board_sec)
         mode, station_stop, station_name, route_id, route_short_name, route_long_name, trip_headsign,
         from_name, to_name, board_sec, arrive_sec, leave_sec, minutes
  FROM busleg
  ORDER BY 2, 4, 10;
$$;

CREATE OR REPLACE FUNCTION public.egress_legs(
  p_station text,
  p_lat numeric,
  p_lon numeric,
  p_allow_drive boolean DEFAULT false,
  p_earliest integer DEFAULT 0,
  p_window_sec integer DEFAULT 7200,
  p_walk_radius_m integer DEFAULT 1207,
  p_point_radius_m integer DEFAULT 805,
  p_station_radius_m integer DEFAULT 402
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
           NULL::text AS headsign, st.stop_name AS from_name, 'Home'::text AS to_name,
           NULL::integer AS board_sec, NULL::integer AS arrive_sec,
           ceil(st.dist / 80.47)::integer AS minutes
    FROM st WHERE st.dist <= p_walk_radius_m
    UNION ALL
    SELECT 'drive', NULL, NULL, NULL, NULL, st.stop_name, 'Home', NULL, NULL,
           (ceil(st.dist / 670.6) + 3)::integer
    FROM st WHERE p_allow_drive AND st.dist <= 64374
  ),
  board AS MATERIALIZED (
    SELECT ns.stop_id, ns.stop_name, ceil(ns.distance_m / 80.47)::integer AS walk_min
    FROM st CROSS JOIN LATERAL nearby_stops(st.stop_lat, st.stop_lon, p_station_radius_m) ns
  ),
  arrive AS MATERIALIZED (
    SELECT n.stop_id, n.stop_name, ceil(n.distance_m / 80.47)::integer AS walk_min
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

GRANT EXECUTE ON FUNCTION public.access_legs(numeric, numeric, text, boolean, integer, integer, integer, integer, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.egress_legs(text, numeric, numeric, boolean, integer, integer, integer, integer, integer) TO anon, authenticated, service_role;
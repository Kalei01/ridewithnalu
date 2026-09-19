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
           NULL::text AS headsign, st.stop_name AS from_name, 'Home'::text AS to_name,
           NULL::integer AS board_sec, NULL::integer AS arrive_sec,
           ceil(st.dist / 83.33)::integer AS minutes
    FROM st WHERE st.dist <= p_walk_radius_m
    UNION ALL
    SELECT 'drive', NULL, NULL, NULL, NULL, st.stop_name, 'Home', NULL, NULL,
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

GRANT EXECUTE ON FUNCTION public.egress_legs(text, numeric, numeric, boolean, integer, integer, integer, integer, integer) TO anon, authenticated, service_role;
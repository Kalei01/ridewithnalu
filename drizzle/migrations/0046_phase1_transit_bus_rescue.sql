-- Phase 1 transit hardening: broaden direct bus rescue and correct walk-leg minutes.\n\n-- General transit fallback: when a rail-inclusive itinerary cannot be found,
-- return a direct bus itinerary from the actual trip origin to a stop near the
-- actual destination. Transit is a family of modes; rail is not a prerequisite.
CREATE OR REPLACE FUNCTION public.plan_bus_direct(
  p_origin_lat numeric,
  p_origin_lon numeric,
  p_dest_lat numeric,
  p_dest_lon numeric,
  p_after_seconds integer DEFAULT NULL,
  p_limit integer DEFAULT 4,
  p_origin_radius_m integer DEFAULT 4000,
  p_dest_radius_m integer DEFAULT 3000
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
  active AS MATERIALIZED (SELECT DISTINCT service_id FROM active_service_ids()),
  origins AS MATERIALIZED (
    SELECT n.stop_id, n.stop_name, n.distance_m,
           ceil(n.distance_m / 80.47)::integer AS walk_sec
    FROM nearby_stops(p_origin_lat, p_origin_lon, p_origin_radius_m) n
    ORDER BY n.distance_m
    LIMIT 12
  ),
  destinations AS MATERIALIZED (
    SELECT n.stop_id, n.stop_name, n.distance_m,
           ceil(n.distance_m / 80.47)::integer AS walk_sec
    FROM nearby_stops(p_dest_lat, p_dest_lon, p_dest_radius_m) n
    ORDER BY n.distance_m
    LIMIT 12
  ),
  rides AS MATERIALIZED (
    SELECT o.stop_id AS origin_stop, o.stop_name AS origin_name,
           d.stop_id AS dest_stop, d.stop_name AS dest_name,
           o.walk_sec AS origin_walk_sec, d.walk_sec AS dest_walk_sec,
           r.route_short_name, r.route_long_name, t.trip_headsign,
           gtfs_seconds(a.departure_time) AS dep_sec,
           gtfs_seconds(b.arrival_time) AS arr_sec
    FROM origins o
    JOIN stop_times a ON a.stop_id = o.stop_id
    JOIN trips t ON t.trip_id = a.trip_id
    JOIN routes r ON r.route_id = t.route_id AND r.route_type = 3
    JOIN stop_times b ON b.trip_id = a.trip_id AND b.stop_sequence > a.stop_sequence
    JOIN destinations d ON d.stop_id = b.stop_id
    WHERE t.service_id IN (SELECT service_id FROM active)
      AND gtfs_seconds(a.departure_time) >= (SELECT after_sec FROM v) + o.walk_sec * 60
      AND gtfs_seconds(a.departure_time) <= (SELECT after_sec FROM v) + 10800
  ),
  ranked AS (
    SELECT *,
           dep_sec - origin_walk_sec * 60 AS leave_sec,
           arr_sec + dest_walk_sec * 60 AS door_sec
    FROM rides
  ),
  best AS (
    SELECT DISTINCT ON (door_sec)
           leave_sec, dep_sec, arr_sec, door_sec,
           ((door_sec - leave_sec) / 60)::integer AS total_min,
           route_short_name, route_long_name, trip_headsign,
           origin_name, dest_name, origin_stop, dest_stop,
           origin_walk_sec, dest_walk_sec
    FROM ranked
    ORDER BY door_sec, leave_sec
    LIMIT p_limit
  )
  SELECT leave_sec, dep_sec, door_sec, total_min, NULL::text,
         jsonb_build_array(
           CASE WHEN origin_walk_sec > 0 THEN jsonb_build_object(
             'kind','access','mode','walk','route_short',NULL,'route_long',NULL,'headsign',NULL,
             'from','Your location','to',origin_name,'from_stop_id',NULL,'to_stop_id',origin_stop,
             'depart_seconds',leave_sec,'arrive_seconds',dep_sec,'minutes',origin_walk_sec
           ) ELSE jsonb_build_object(
             'kind','access','mode','walk','route_short',NULL,'route_long',NULL,'headsign',NULL,
             'from','Your location','to',origin_name,'from_stop_id',NULL,'to_stop_id',origin_stop,
             'depart_seconds',leave_sec,'arrive_seconds',dep_sec,'minutes',0
           ) END,
           jsonb_build_object(
             'kind','connect','mode','bus','route_short',route_short_name,'route_long',route_long_name,
             'headsign',trip_headsign,'from',origin_name,'to',dest_name,
             'from_stop_id',origin_stop,'to_stop_id',dest_stop,
             'depart_seconds',dep_sec,'arrive_seconds',arr_sec,'minutes',((arr_sec-dep_sec)/60)::integer
           ),
           CASE WHEN dest_walk_sec > 0 THEN jsonb_build_object(
             'kind','egress','mode','walk','route_short',NULL,'route_long',NULL,'headsign',NULL,
             'from',dest_name,'to','Your destination','from_stop_id',dest_stop,'to_stop_id',NULL,
             'depart_seconds',arr_sec,'arrive_seconds',door_sec,'minutes',dest_walk_sec
           ) ELSE jsonb_build_object(
             'kind','egress','mode','walk','route_short',NULL,'route_long',NULL,'headsign',NULL,
             'from',dest_name,'to','Your destination','from_stop_id',dest_stop,'to_stop_id',NULL,
             'depart_seconds',arr_sec,'arrive_seconds',door_sec,'minutes',0
           ) END
         )
  FROM best
  ORDER BY door_sec;
$$;
GRANT EXECUTE ON FUNCTION public.plan_bus_direct(numeric,numeric,numeric,numeric,integer,integer,integer,integer) TO anon, authenticated, service_role;

-- General transit recovery planner.
-- Walking access is intentionally broader than the legacy rail planner.
-- Finds complete door-to-door public-transit itineraries without making
-- Skyline a prerequisite: direct bus/rail plus one timed transfer.
CREATE OR REPLACE FUNCTION public.plan_transit_general(
  p_origin_lat numeric,
  p_origin_lon numeric,
  p_dest_lat numeric,
  p_dest_lon numeric,
  p_after_seconds integer DEFAULT NULL,
  p_limit integer DEFAULT 6,
  p_origin_radius_m integer DEFAULT 6000,
  p_dest_radius_m integer DEFAULT 4000,
  p_transfer_radius_m integer DEFAULT 1200
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
        + extract(second FROM now() AT TIME ZONE 'Pacific/Honolulu')::int
    ) AS after_sec
  ),
  active AS MATERIALIZED (
    SELECT DISTINCT service_id FROM active_service_ids()
  ),
  origins AS MATERIALIZED (
    SELECT n.stop_id, n.stop_name, n.stop_lat, n.stop_lon,
           ceil(n.distance_m / 80.47)::integer AS walk_min
    FROM nearby_stops(p_origin_lat, p_origin_lon, p_origin_radius_m) n
    ORDER BY n.distance_m
    LIMIT 40
  ),
  destinations AS MATERIALIZED (
    SELECT n.stop_id, n.stop_name, n.stop_lat, n.stop_lon,
           ceil(n.distance_m / 80.47)::integer AS walk_min
    FROM nearby_stops(p_dest_lat, p_dest_lon, p_dest_radius_m) n
    ORDER BY n.distance_m
    LIMIT 40
  ),
  direct AS MATERIALIZED (
    SELECT
      o.walk_min AS origin_walk_min,
      d.walk_min AS dest_walk_min,
      o.stop_id AS origin_stop,
      o.stop_name AS origin_name,
      d.stop_id AS dest_stop,
      d.stop_name AS dest_name,
      t.trip_id,
      t.service_id,
      r.route_type,
      r.route_short_name,
      r.route_long_name,
      t.trip_headsign,
      gtfs_seconds(a.departure_time) AS dep_sec,
      gtfs_seconds(b.arrival_time) AS arr_sec
    FROM origins o
    JOIN stop_times a ON a.stop_id = o.stop_id
    JOIN trips t ON t.trip_id = a.trip_id
    JOIN routes r ON r.route_id = t.route_id AND r.route_type IN (1, 3)
    JOIN stop_times b ON b.trip_id = a.trip_id AND b.stop_sequence > a.stop_sequence
    JOIN destinations d ON d.stop_id = b.stop_id
    WHERE t.service_id IN (SELECT service_id FROM active)
      AND gtfs_seconds(a.departure_time) >= (SELECT after_sec FROM v) + o.walk_min * 60
      AND gtfs_seconds(a.departure_time) <= (SELECT after_sec FROM v) + 10800
    ORDER BY gtfs_seconds(b.arrival_time), gtfs_seconds(a.departure_time)
    LIMIT 80
  ),
  -- Anchor transfer candidates to stops that actually feed a destination.
  -- This prevents the candidate limit from discarding distant transfer hubs.
  feeder_boarding AS MATERIALIZED (
    SELECT DISTINCT
      c.stop_id AS board_stop,
      bs.stop_lat,
      bs.stop_lon
    FROM destinations dest
    JOIN stop_times d ON d.stop_id = dest.stop_id
    JOIN trips t2 ON t2.trip_id = d.trip_id
    JOIN routes r2 ON r2.route_id = t2.route_id AND r2.route_type IN (1, 3)
    JOIN stop_times c ON c.trip_id = d.trip_id AND c.stop_sequence < d.stop_sequence
    JOIN stops bs ON bs.stop_id = c.stop_id
    WHERE t2.service_id IN (SELECT service_id FROM active)
      AND gtfs_seconds(c.departure_time) BETWEEN (SELECT after_sec FROM v)
                                               AND (SELECT after_sec FROM v) + 14400
  ),
  transfer_points AS MATERIALIZED (
    SELECT DISTINCT ns.stop_id
    FROM feeder_boarding f
    CROSS JOIN LATERAL nearby_stops(f.stop_lat, f.stop_lon, p_transfer_radius_m) ns
  ),
  transfer_first AS MATERIALIZED (
    SELECT
      o.walk_min AS origin_walk_min,
      o.stop_id AS origin_stop,
      o.stop_name AS origin_name,
      t.trip_id AS first_trip_id,
      r.route_type AS first_route_type,
      r.route_short_name AS first_route_short,
      r.route_long_name AS first_route_long,
      t.trip_headsign AS first_headsign,
      gtfs_seconds(a.departure_time) AS first_dep_sec,
      gtfs_seconds(b.arrival_time) AS first_arr_sec,
      b.stop_id AS first_stop_id,
      bs.stop_name AS first_stop_name,
      bs.stop_lat AS first_stop_lat,
      bs.stop_lon AS first_stop_lon
    FROM origins o
    JOIN stop_times a ON a.stop_id = o.stop_id
    JOIN trips t ON t.trip_id = a.trip_id
    JOIN routes r ON r.route_id = t.route_id AND r.route_type IN (1, 3)
    JOIN stop_times b ON b.trip_id = a.trip_id AND b.stop_sequence > a.stop_sequence
    JOIN stops bs ON bs.stop_id = b.stop_id
    JOIN transfer_points tp ON tp.stop_id = b.stop_id
    WHERE t.service_id IN (SELECT service_id FROM active)
      AND gtfs_seconds(a.departure_time) >= (SELECT after_sec FROM v) + o.walk_min * 60
      AND gtfs_seconds(a.departure_time) <= (SELECT after_sec FROM v) + 10800
    ORDER BY gtfs_seconds(b.arrival_time), gtfs_seconds(a.departure_time)
    LIMIT 200
  ),
  transfers AS MATERIALIZED (
    SELECT
      f.origin_walk_min,
      f.origin_stop,
      f.origin_name,
      f.first_trip_id,
      f.first_route_type,
      f.first_route_short,
      f.first_route_long,
      f.first_headsign,
      f.first_dep_sec,
      f.first_arr_sec,
      f.first_stop_id,
      f.first_stop_name,
      s.stop_id AS second_stop_id,
      s.stop_name AS second_stop_name,
      s.distance_m AS transfer_distance_m,
      ceil(s.distance_m / 80.47)::integer AS transfer_walk_min,
      t2.trip_id AS second_trip_id,
      r2.route_type AS second_route_type,
      r2.route_short_name AS second_route_short,
      r2.route_long_name AS second_route_long,
      t2.trip_headsign AS second_headsign,
      gtfs_seconds(c.departure_time) AS second_dep_sec,
      gtfs_seconds(d.arrival_time) AS second_arr_sec,
      d.stop_id AS dest_stop_id,
      ds.stop_name AS dest_stop_name,
      dest.walk_min AS dest_walk_min
    FROM transfer_first f
    CROSS JOIN LATERAL nearby_stops(f.first_stop_lat, f.first_stop_lon, p_transfer_radius_m) s
    JOIN stop_times c ON c.stop_id = s.stop_id
    JOIN trips t2 ON t2.trip_id = c.trip_id AND t2.trip_id <> f.first_trip_id
    JOIN routes r2 ON r2.route_id = t2.route_id AND r2.route_type IN (1, 3)
    JOIN stop_times d ON d.trip_id = c.trip_id AND d.stop_sequence > c.stop_sequence
    JOIN stops ds ON ds.stop_id = d.stop_id
    JOIN destinations dest ON dest.stop_id = d.stop_id
    WHERE t2.service_id IN (SELECT service_id FROM active)
      AND gtfs_seconds(c.departure_time) >= f.first_arr_sec + ceil(s.distance_m / 80.47)::integer * 60 + 60
      AND gtfs_seconds(c.departure_time) <= (SELECT after_sec FROM v) + 14400
    ORDER BY gtfs_seconds(d.arrival_time), gtfs_seconds(c.departure_time)
    LIMIT 80
  ),
  direct_rows AS (
    SELECT
      dep_sec - origin_walk_min * 60 AS leave_sec,
      dep_sec,
      arr_sec + dest_walk_min * 60 AS door_sec,
      CASE WHEN route_type = 1 THEN trip_id ELSE NULL END AS rail_trip,
      origin_name,
      dest_name,
      origin_stop,
      dest_stop,
      origin_walk_min,
      dest_walk_min,
      route_type,
      route_short_name,
      route_long_name,
      trip_headsign,
      dep_sec AS transit_dep,
      arr_sec AS transit_arr
    FROM direct
  ),
  transfer_rows AS (
    SELECT
      first_dep_sec - origin_walk_min * 60 AS leave_sec,
      first_dep_sec AS dep_sec,
      second_arr_sec + dest_walk_min * 60 AS door_sec,
      CASE
        WHEN first_route_type = 1 THEN first_trip_id
        WHEN second_route_type = 1 THEN second_trip_id
        ELSE NULL
      END AS rail_trip,
      origin_name,
      dest_stop_name AS dest_name,
      origin_stop,
      dest_stop_id AS dest_stop,
      origin_walk_min,
      dest_walk_min,
      first_route_type,
      first_route_short,
      first_route_long,
      first_headsign,
      first_dep_sec,
      first_arr_sec,
      first_stop_id,
      first_stop_name,
      second_route_type,
      second_route_short,
      second_route_long,
      second_headsign,
      second_dep_sec,
      second_arr_sec,
      second_stop_id,
      second_stop_name,
      transfer_walk_min
    FROM transfers
  ),
  direct_best AS (
    SELECT DISTINCT ON (door_sec)
      leave_sec, dep_sec, door_sec, rail_trip, origin_name, dest_name,
      origin_stop, dest_stop, origin_walk_min, dest_walk_min,
      route_type, route_short_name, route_long_name, trip_headsign,
      transit_dep, transit_arr
    FROM direct_rows
    ORDER BY door_sec, leave_sec
    LIMIT p_limit
  ),
  transfer_best AS (
    SELECT DISTINCT ON (door_sec)
      leave_sec, dep_sec, door_sec, rail_trip, origin_name, dest_name,
      origin_stop, dest_stop, origin_walk_min, dest_walk_min,
      first_route_type, first_route_short, first_route_long, first_headsign,
      first_dep_sec, first_arr_sec, first_stop_id, first_stop_name,
      second_route_type, second_route_short, second_route_long, second_headsign,
      second_dep_sec, second_arr_sec, second_stop_id, second_stop_name,
      transfer_walk_min
    FROM transfer_rows
    ORDER BY door_sec, leave_sec
    LIMIT p_limit
  ),
  all_options AS (
    SELECT
      leave_sec, dep_sec, door_sec, rail_trip,
      jsonb_build_array(
        jsonb_build_object(
          'kind','access','mode','walk','route_short',NULL,'route_long',NULL,'headsign',NULL,
          'from','Your location','to',origin_name,'from_stop_id',NULL,'to_stop_id',origin_stop,
          'depart_seconds',leave_sec,'arrive_seconds',dep_sec,'minutes',origin_walk_min
        ),
        jsonb_build_object(
          'kind', CASE WHEN route_type = 1 THEN 'rail' ELSE 'connect' END,
          'mode', CASE WHEN route_type = 1 THEN 'rail' ELSE 'bus' END,
          'route_short',route_short_name,'route_long',route_long_name,'headsign',trip_headsign,
          'from',origin_name,'to',dest_name,'from_stop_id',origin_stop,'to_stop_id',dest_stop,
          'depart_seconds',transit_dep,'arrive_seconds',transit_arr,
          'minutes',((transit_arr-transit_dep)/60)::integer
        ),
        jsonb_build_object(
          'kind','egress','mode','walk','route_short',NULL,'route_long',NULL,'headsign',NULL,
          'from',dest_name,'to','Your destination','from_stop_id',dest_stop,'to_stop_id',NULL,
          'depart_seconds',transit_arr,'arrive_seconds',door_sec,'minutes',dest_walk_min
        )
      ) AS legs
    FROM direct_best
    UNION ALL
    SELECT
      leave_sec, dep_sec, door_sec, rail_trip,
      jsonb_build_array(
        jsonb_build_object(
          'kind','access','mode','walk','route_short',NULL,'route_long',NULL,'headsign',NULL,
          'from','Your location','to',origin_name,'from_stop_id',NULL,'to_stop_id',origin_stop,
          'depart_seconds',leave_sec,'arrive_seconds',first_dep_sec,'minutes',origin_walk_min
        ),
        jsonb_build_object(
          'kind', CASE WHEN first_route_type = 1 THEN 'rail' ELSE 'connect' END,
          'mode', CASE WHEN first_route_type = 1 THEN 'rail' ELSE 'bus' END,
          'route_short',first_route_short,'route_long',first_route_long,'headsign',first_headsign,
          'from',origin_name,'to',first_stop_name,'from_stop_id',origin_stop,'to_stop_id',first_stop_id,
          'depart_seconds',first_dep_sec,'arrive_seconds',first_arr_sec,
          'minutes',((first_arr_sec-first_dep_sec)/60)::integer
        ),
        jsonb_build_object(
          'kind','connect','mode','walk','route_short',NULL,'route_long',NULL,'headsign',NULL,
          'from',first_stop_name,'to',second_stop_name,'from_stop_id',first_stop_id,'to_stop_id',second_stop_id,
          'depart_seconds',first_arr_sec,'arrive_seconds',second_dep_sec,'minutes',transfer_walk_min
        ),
        jsonb_build_object(
          'kind', CASE WHEN second_route_type = 1 THEN 'rail' ELSE 'connect' END,
          'mode', CASE WHEN second_route_type = 1 THEN 'rail' ELSE 'bus' END,
          'route_short',second_route_short,'route_long',second_route_long,'headsign',second_headsign,
          'from',second_stop_name,'to',dest_name,'from_stop_id',second_stop_id,'to_stop_id',dest_stop,
          'depart_seconds',second_dep_sec,'arrive_seconds',second_arr_sec,
          'minutes',((second_arr_sec-second_dep_sec)/60)::integer
        ),
        jsonb_build_object(
          'kind','egress','mode','walk','route_short',NULL,'route_long',NULL,'headsign',NULL,
          'from',dest_name,'to','Your destination','from_stop_id',dest_stop,'to_stop_id',NULL,
          'depart_seconds',second_arr_sec,'arrive_seconds',door_sec,'minutes',dest_walk_min
        )
      ) AS legs
    FROM transfer_best
  )
  SELECT
    leave_sec,
    dep_sec,
    door_sec,
    GREATEST(1, ((door_sec - leave_sec) / 60)::integer) AS total_min,
    rail_trip,
    legs
  FROM all_options
  ORDER BY door_sec, leave_sec
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.plan_transit_general(numeric,numeric,numeric,numeric,integer,integer,integer,integer,integer)
  TO anon, authenticated, service_role;

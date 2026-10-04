-- Faster general transit planner (same itineraries, same signature).
--
-- The old plan_transit_general took 6-56 s on common trips, past the 8-10 s
-- API time limit, so the app never saw its results. Measured on 7 island
-- trips, this version runs in 0.5-1.7 s with the same leave and arrival times.
--
-- What changed:
--   * Today's trips (a few thousand of ~38k) are filtered once, first.
--   * Rides that reach a destination stop are computed once (feeder) and
--     reused for both transfer candidates and second legs, instead of the
--     second leg starting from every trip through the destination all day.
--   * Destination arrivals before the search window are skipped (a ride can't
--     reach the destination before it boards).
--   * Ties (same arrival and leave time) now pick the option with the least
--     walking, then the earlier boarding, instead of an arbitrary one.
-- CREATE OR REPLACE keeps the existing grants.
CREATE OR REPLACE FUNCTION public.plan_transit_general(p_origin_lat numeric, p_origin_lon numeric, p_dest_lat numeric, p_dest_lon numeric, p_after_seconds integer DEFAULT NULL::integer, p_limit integer DEFAULT 6, p_origin_radius_m integer DEFAULT 4000, p_dest_radius_m integer DEFAULT 3000, p_transfer_radius_m integer DEFAULT 800)
 RETURNS TABLE(leave_by_seconds integer, depart_seconds integer, arrive_seconds integer, total_minutes integer, rail_trip_id text, legs jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- Today's bus and rail trips, filtered once up front (a few thousand of the
  -- whole feed) so every later join only touches trips that actually run.
  active_trips AS MATERIALIZED (
    SELECT t.trip_id, t.trip_headsign, r.route_type, r.route_short_name, r.route_long_name
    FROM trips t
    JOIN routes r ON r.route_id = t.route_id AND r.route_type IN (1, 3)
    WHERE t.service_id IN (SELECT service_id FROM active)
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
  -- Boardings near the origin within the next three hours.
  origin_departures AS MATERIALIZED (
    SELECT o.walk_min, o.stop_id, o.stop_name,
           a.trip_id, a.stop_sequence, gtfs_seconds(a.departure_time) AS dep_sec,
           at.route_type, at.route_short_name, at.route_long_name, at.trip_headsign
    FROM origins o
    JOIN stop_times a ON a.stop_id = o.stop_id
    JOIN active_trips at ON at.trip_id = a.trip_id
    WHERE gtfs_seconds(a.departure_time) >= (SELECT after_sec FROM v) + o.walk_min * 60
      AND gtfs_seconds(a.departure_time) <= (SELECT after_sec FROM v) + 10800
  ),
  -- Every later stop those boardings reach.
  origin_rides AS MATERIALIZED (
    SELECT od.*, b.stop_id AS alight_stop, gtfs_seconds(b.arrival_time) AS arr_sec
    FROM origin_departures od
    JOIN stop_times b ON b.trip_id = od.trip_id AND b.stop_sequence > od.stop_sequence
  ),
  direct AS MATERIALIZED (
    SELECT
      r.walk_min AS origin_walk_min,
      d.walk_min AS dest_walk_min,
      r.stop_id AS origin_stop,
      r.stop_name AS origin_name,
      d.stop_id AS dest_stop,
      d.stop_name AS dest_name,
      r.trip_id,
      r.route_type,
      r.route_short_name,
      r.route_long_name,
      r.trip_headsign,
      r.dep_sec,
      r.arr_sec
    FROM origin_rides r
    JOIN destinations d ON d.stop_id = r.alight_stop
    ORDER BY r.arr_sec, r.dep_sec
    LIMIT 80
  ),
  -- Today's arrivals at destination stops. A ride can only reach the
  -- destination after it boards, so arrivals before the search window can
  -- never pair with a boarding in it.
  dest_arrivals AS MATERIALIZED (
    SELECT d.trip_id, d.stop_sequence, d.stop_id AS dest_stop_id,
           gtfs_seconds(d.arrival_time) AS dest_arr_sec, dest.walk_min AS dest_walk_min,
           at.route_type, at.route_short_name, at.route_long_name, at.trip_headsign
    FROM destinations dest
    JOIN stop_times d ON d.stop_id = dest.stop_id
    JOIN active_trips at ON at.trip_id = d.trip_id
    WHERE gtfs_seconds(d.arrival_time) >= (SELECT after_sec FROM v)
  ),
  -- Rides that reach a destination stop, boarded in the next four hours.
  -- Computed once and reused for both transfer candidates and second legs.
  feeder AS MATERIALIZED (
    SELECT
      c.stop_id AS board_stop,
      c.trip_id,
      gtfs_seconds(c.departure_time) AS board_dep_sec,
      da.route_type, da.route_short_name, da.route_long_name, da.trip_headsign,
      da.dest_stop_id,
      da.dest_arr_sec,
      da.dest_walk_min
    FROM dest_arrivals da
    JOIN stop_times c ON c.trip_id = da.trip_id AND c.stop_sequence < da.stop_sequence
    WHERE gtfs_seconds(c.departure_time) BETWEEN (SELECT after_sec FROM v)
                                             AND (SELECT after_sec FROM v) + 14400
  ),
  feeder_boarding AS MATERIALIZED (
    SELECT DISTINCT f.board_stop, bs.stop_lat, bs.stop_lon
    FROM feeder f
    JOIN stops bs ON bs.stop_id = f.board_stop
  ),
  transfer_points AS MATERIALIZED (
    SELECT DISTINCT ns.stop_id
    FROM feeder_boarding f
    CROSS JOIN LATERAL nearby_stops(f.stop_lat, f.stop_lon, p_transfer_radius_m) ns
  ),
  transfer_first AS MATERIALIZED (
    SELECT
      r.walk_min AS origin_walk_min,
      r.stop_id AS origin_stop,
      r.stop_name AS origin_name,
      r.trip_id AS first_trip_id,
      r.route_type AS first_route_type,
      r.route_short_name AS first_route_short,
      r.route_long_name AS first_route_long,
      r.trip_headsign AS first_headsign,
      r.dep_sec AS first_dep_sec,
      r.arr_sec AS first_arr_sec,
      r.alight_stop AS first_stop_id,
      bs.stop_name AS first_stop_name,
      bs.stop_lat AS first_stop_lat,
      bs.stop_lon AS first_stop_lon
    FROM origin_rides r
    JOIN transfer_points tp ON tp.stop_id = r.alight_stop
    JOIN stops bs ON bs.stop_id = r.alight_stop
    ORDER BY r.arr_sec, r.dep_sec
    LIMIT 200
  ),
  transfer_walks AS MATERIALIZED (
    SELECT f.*, s.stop_id AS second_stop_id, s.stop_name AS second_stop_name,
           s.distance_m AS transfer_distance_m,
           ceil(s.distance_m / 80.47)::integer AS transfer_walk_min
    FROM transfer_first f
    CROSS JOIN LATERAL nearby_stops(f.first_stop_lat, f.first_stop_lon, p_transfer_radius_m) s
  ),
  transfers AS MATERIALIZED (
    SELECT
      w.origin_walk_min,
      w.origin_stop,
      w.origin_name,
      w.first_trip_id,
      w.first_route_type,
      w.first_route_short,
      w.first_route_long,
      w.first_headsign,
      w.first_dep_sec,
      w.first_arr_sec,
      w.first_stop_id,
      w.first_stop_name,
      w.second_stop_id,
      w.second_stop_name,
      w.transfer_distance_m,
      w.transfer_walk_min,
      fd.trip_id AS second_trip_id,
      fd.route_type AS second_route_type,
      fd.route_short_name AS second_route_short,
      fd.route_long_name AS second_route_long,
      fd.trip_headsign AS second_headsign,
      fd.board_dep_sec AS second_dep_sec,
      fd.dest_arr_sec AS second_arr_sec,
      fd.dest_stop_id,
      ds.stop_name AS dest_stop_name,
      fd.dest_walk_min
    FROM transfer_walks w
    JOIN feeder fd ON fd.board_stop = w.second_stop_id AND fd.trip_id <> w.first_trip_id
    JOIN stops ds ON ds.stop_id = fd.dest_stop_id
    WHERE fd.board_dep_sec >= w.first_arr_sec + w.transfer_walk_min * 60 + 60
    ORDER BY fd.dest_arr_sec, fd.board_dep_sec
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
    -- Same arrival and leave time: prefer less walking, then the earlier boarding.
    ORDER BY door_sec, leave_sec, origin_walk_min + dest_walk_min, dep_sec, rail_trip, origin_stop, dest_stop
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
    -- Same arrival and leave time: prefer less walking, then the earlier boarding.
    ORDER BY door_sec, leave_sec, origin_walk_min + transfer_walk_min + dest_walk_min, dep_sec,
             second_dep_sec, first_stop_id, second_stop_id, dest_stop
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
$function$;

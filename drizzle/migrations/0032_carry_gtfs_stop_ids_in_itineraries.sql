DROP FUNCTION IF EXISTS public.access_legs(numeric, numeric, text, boolean, integer, integer, integer, integer, integer);

CREATE OR REPLACE FUNCTION public.access_legs(p_lat numeric, p_lon numeric, p_station text DEFAULT NULL::text, p_allow_drive boolean DEFAULT false, p_earliest integer DEFAULT 0, p_window_sec integer DEFAULT 10800, p_walk_radius_m integer DEFAULT 1207, p_board_radius_m integer DEFAULT 805, p_station_radius_m integer DEFAULT 1207)
 RETURNS TABLE(mode text, station_stop text, station_name text, route_id text, route_short_name text, route_long_name text, headsign text, from_stop_name text, to_stop_name text, board_seconds integer, arrive_seconds integer, leave_by_seconds integer, minutes integer, from_stop_id text, to_stop_id text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
           ceil(s.dist / 80.47)::integer AS minutes,
           NULL::text AS from_id, s.stop_id AS to_id
    FROM stations s
    WHERE s.dist <= p_walk_radius_m
    UNION ALL
    SELECT 'drive', s.stop_id, s.stop_name, NULL, NULL, NULL, NULL,
           'Your location', s.stop_name, NULL, NULL, NULL,
           (ceil(s.dist / 670.6) + 3)::integer,
           NULL::text, s.stop_id
    FROM stations s
    WHERE p_allow_drive AND s.dist <= 64374
  ),
  board AS MATERIALIZED (
    SELECT n.stop_id, n.stop_name, ceil(n.distance_m / 80.47)::integer AS walk_min
    FROM nearby_stops(p_lat, p_lon, p_board_radius_m) n
  ),
  target AS MATERIALIZED (
    SELECT s.stop_id AS station_stop, s.stop_name AS station_name,
           ns.stop_id AS near_stop,
           min(CASE WHEN ns.distance_m > 402 THEN ceil(ns.distance_m / 80.47) ELSE 0 END)::integer AS walk_min
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
             + bd.walk_min + tg.walk_min)::integer AS minutes,
           bd.stop_id AS from_id, tg.station_stop AS to_id
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
         from_name, to_name, board_sec, arrive_sec, leave_sec, minutes, from_id, to_id
  FROM flexible
  UNION ALL
  SELECT DISTINCT ON (station_stop, route_id, board_sec)
         mode, station_stop, station_name, route_id, route_short_name, route_long_name, trip_headsign,
         from_name, to_name, board_sec, arrive_sec, leave_sec, minutes, from_id, to_id
  FROM busleg
  ORDER BY 2, 4, 10;
$function$;

DROP FUNCTION IF EXISTS public.egress_legs(text, numeric, numeric, boolean, integer, integer, integer, integer, integer);

CREATE OR REPLACE FUNCTION public.egress_legs(p_station text, p_lat numeric, p_lon numeric, p_allow_drive boolean DEFAULT false, p_earliest integer DEFAULT 0, p_window_sec integer DEFAULT 7200, p_walk_radius_m integer DEFAULT 1207, p_point_radius_m integer DEFAULT 805, p_station_radius_m integer DEFAULT 402)
 RETURNS TABLE(mode text, route_id text, route_short_name text, route_long_name text, headsign text, from_stop_name text, to_stop_name text, board_seconds integer, arrive_seconds integer, minutes integer, from_stop_id text, to_stop_id text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
           ceil(st.dist / 80.47)::integer AS minutes,
           st.stop_id AS from_id, NULL::text AS to_id
    FROM st WHERE st.dist <= p_walk_radius_m
    UNION ALL
    SELECT 'drive', NULL, NULL, NULL, NULL, st.stop_name, 'Home', NULL, NULL,
           (ceil(st.dist / 670.6) + 3)::integer,
           st.stop_id, NULL::text
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
             + bd.walk_min + ar.walk_min)::integer AS minutes,
           bd.stop_id AS from_id, ar.stop_id AS to_id
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
  SELECT mode, route_id, rshort, rlong, headsign, from_name, to_name, board_sec, arrive_sec, minutes, from_id, to_id FROM flexible
  UNION ALL
  SELECT mode, route_id, route_short_name, route_long_name, trip_headsign, from_name, to_name, board_sec, arrive_sec, minutes, from_id, to_id FROM busleg;
$function$;

CREATE OR REPLACE FUNCTION public.plan_inbound(p_dest_lat numeric, p_dest_lon numeric, p_station text, p_home_lat numeric, p_home_lon numeric, p_allow_drive boolean DEFAULT false, p_after_seconds integer DEFAULT NULL::integer, p_limit integer DEFAULT 4, p_transfer_buffer_seconds integer DEFAULT 240)
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
    ) AS after_sec
  ),
  active AS MATERIALIZED (SELECT DISTINCT a.service_id FROM active_service_ids() a),
  acc AS MATERIALIZED (
    SELECT a.*,
           CASE WHEN a.arrive_seconds IS NULL
                THEN (SELECT after_sec FROM v) + a.minutes * 60
                ELSE a.arrive_seconds + 120 END AS ready_sec,
           CASE WHEN a.mode = 'bus' AND a.board_seconds IS NOT NULL AND a.leave_by_seconds IS NOT NULL
                THEN greatest(0, a.board_seconds - a.leave_by_seconds) ELSE 0 END AS walk_sec
    FROM access_legs(p_dest_lat, p_dest_lon, NULL, false, (SELECT after_sec FROM v)) a
    WHERE a.station_stop <> p_station
  ),
  scored_acc AS MATERIALIZED (
    SELECT ac.*, greatest(0, ac.walk_sec - 300) * 2 AS walk_penalty FROM acc ac
  ),
  stations AS MATERIALIZED (
    SELECT station_stop, min(ready_sec) AS ready_sec FROM scored_acc GROUP BY station_stop
  ),
  rides AS MATERIALIZED (
    SELECT * FROM (
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
        LIMIT 4
      ) ride
    ) r0
    ORDER BY r0.arr_sec
    LIMIT 12
  ),
  eg AS MATERIALIZED (
    SELECT * FROM egress_legs(
      p_station, p_home_lat, p_home_lon, p_allow_drive,
      (SELECT coalesce(min(arr_sec), 0) FROM rides)
    )
  ),
  withlegs AS (
    SELECT r.*, a.*, e.*
    FROM rides r
    CROSS JOIN LATERAL (
      SELECT ac.mode AS a_mode, ac.route_short_name AS a_short, ac.route_long_name AS a_long,
             ac.headsign AS a_headsign, ac.from_stop_name AS a_from, ac.to_stop_name AS a_to,
             ac.from_stop_id AS a_from_id, ac.to_stop_id AS a_to_id,
             ac.minutes AS a_minutes, ac.board_seconds AS a_board, ac.walk_penalty AS a_walk_penalty,
             CASE WHEN ac.arrive_seconds IS NULL THEN r.dep_sec - ac.minutes * 60
                  ELSE ac.leave_by_seconds END AS a_leave_by,
             CASE WHEN ac.arrive_seconds IS NULL THEN r.dep_sec ELSE ac.arrive_seconds END AS a_arrive
      FROM scored_acc ac
      WHERE ac.station_stop = r.station_stop AND ac.ready_sec <= r.dep_sec
      ORDER BY ac.walk_penalty,
               CASE WHEN ac.arrive_seconds IS NULL THEN r.dep_sec - ac.minutes * 60
                    ELSE ac.leave_by_seconds END DESC,
               ac.minutes
      LIMIT 1
    ) a
    CROSS JOIN LATERAL (
      SELECT e2.mode AS e_mode, e2.route_short_name AS e_short, e2.route_long_name AS e_long,
             e2.headsign AS e_headsign, e2.from_stop_name AS e_from, e2.to_stop_name AS e_to,
             e2.from_stop_id AS e_from_id, e2.to_stop_id AS e_to_id,
             e2.minutes AS e_minutes,
             coalesce(e2.board_seconds, r.arr_sec) AS e_depart,
             coalesce(e2.arrive_seconds, r.arr_sec + e2.minutes * 60) AS e_arrive
      FROM eg e2
      WHERE e2.arrive_seconds IS NULL
         OR e2.board_seconds >= r.arr_sec + p_transfer_buffer_seconds
      ORDER BY coalesce(e2.arrive_seconds, r.arr_sec + e2.minutes * 60)
      LIMIT 1
    ) e
  ),
  ranked AS (
    SELECT w.*,
           w.e_arrive
             + w.a_walk_penalty
             + CASE WHEN w.a_mode = 'bus'
                         AND (w.arr_sec - w.dep_sec) < (w.a_arrive - w.a_leave_by)
                    THEN ((w.a_arrive - w.a_leave_by) - (w.arr_sec - w.dep_sec)) / 2
                    ELSE 0 END AS score
    FROM withlegs w
  ),
  best AS (
    SELECT DISTINCT ON (e_arrive) * FROM ranked ORDER BY e_arrive, score, a_leave_by DESC
  )
  SELECT w.a_leave_by, w.dep_sec, w.e_arrive,
         ((w.e_arrive - w.a_leave_by) / 60)::int,
         w.trip_id,
         jsonb_build_array(
           jsonb_build_object('kind','access','mode',w.a_mode,'route_short',w.a_short,
             'route_long',w.a_long,'headsign',w.a_headsign,'from',w.a_from,'to',w.a_to,
             'from_stop_id',w.a_from_id,'to_stop_id',w.a_to_id,
             'depart_seconds',coalesce(w.a_board, w.a_leave_by),'arrive_seconds',w.a_arrive,'minutes',w.a_minutes),
           jsonb_build_object('kind','rail','mode','rail','route_short',w.route_short_name,
             'route_long',w.route_long_name,'headsign',w.trip_headsign,'from',w.board_name,
             'to',w.alight_name,'from_stop_id',w.station_stop,'to_stop_id',p_station,
             'depart_seconds',w.dep_sec,'arrive_seconds',w.arr_sec,
             'minutes',((w.arr_sec - w.dep_sec)/60)::int),
           jsonb_build_object('kind','egress','mode',w.e_mode,'route_short',w.e_short,
             'route_long',w.e_long,'headsign',w.e_headsign,'from',w.e_from,'to',w.e_to,
             'from_stop_id',w.e_from_id,'to_stop_id',w.e_to_id,
             'depart_seconds',w.e_depart,'arrive_seconds',w.e_arrive,'minutes',w.e_minutes)
         )
  FROM best w
  ORDER BY w.score, w.e_arrive
  LIMIT p_limit;
$function$;

CREATE OR REPLACE FUNCTION public.plan_outbound(p_origin_lat numeric, p_origin_lon numeric, p_station text, p_dest_stop text, p_allow_drive boolean DEFAULT false, p_after_seconds integer DEFAULT NULL::integer, p_limit integer DEFAULT 4, p_bus_route_id text DEFAULT NULL::text, p_transfer_buffer_seconds integer DEFAULT 240, p_transfer_radius_m integer DEFAULT 1207, p_dest_lat numeric DEFAULT NULL::numeric, p_dest_lon numeric DEFAULT NULL::numeric, p_dest_radius_m integer DEFAULT 402)
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
    LIMIT 8
  ),
  arrivals AS MATERIALIZED (
    SELECT d.*, a.stop_id AS xfer_stop, gtfs_seconds(a.arrival_time) AS xfer_sec
    FROM departures d
    JOIN stop_times a ON a.trip_id = d.trip_id AND a.stop_sequence > d.stop_sequence
  ),
  win AS MATERIALIZED (
    SELECT min(xfer_sec) AS lo, max(xfer_sec) + 3600 AS hi FROM arrivals
  ),
  dest_cands AS MATERIALIZED (
    SELECT stop_id, stop_name, walk_sec FROM (
      SELECT n.stop_id, n.stop_name, (ceil(n.distance_m / 80.47) * 60)::int AS walk_sec,
             n.distance_m
      FROM nearby_stops(p_dest_lat, p_dest_lon, p_dest_radius_m) n
      WHERE p_dest_lat IS NOT NULL AND p_dest_lon IS NOT NULL
      UNION ALL
      SELECT s.stop_id, s.stop_name, 0, 0
      FROM stops s WHERE s.stop_id = p_dest_stop
      ORDER BY distance_m
      LIMIT 12
    ) c
  ),
  dest_routes AS MATERIALIZED (
    SELECT DISTINCT t.route_id, coalesce(t.direction_id, 0) AS direction_id
    FROM dest_cands dc
    JOIN stop_times st ON st.stop_id = dc.stop_id
    JOIN trips t ON t.trip_id = st.trip_id
    JOIN routes r ON r.route_id = t.route_id
    WHERE r.route_type <> 1
      AND t.service_id IN (SELECT service_id FROM active)
      AND (p_bus_route_id IS NULL OR t.route_id = p_bus_route_id)
  ),
  pattern_trips AS MATERIALIZED (
    SELECT trip_id FROM (
      SELECT t.trip_id,
             row_number() OVER (PARTITION BY t.route_id, coalesce(t.direction_id, 0)
                                ORDER BY t.trip_id) AS rn
      FROM dest_routes dr
      JOIN trips t ON t.route_id = dr.route_id
                  AND coalesce(t.direction_id, 0) = dr.direction_id
      WHERE t.service_id IN (SELECT service_id FROM active)
    ) s WHERE rn <= 12
  ),
  dest_route_stops AS MATERIALIZED (
    SELECT DISTINCT st.stop_id
    FROM pattern_trips pt
    JOIN stop_times st ON st.trip_id = pt.trip_id
  ),
  rail_targets AS MATERIALIZED (SELECT DISTINCT xfer_stop FROM arrivals),
  links AS MATERIALIZED (
    SELECT rt.xfer_stop AS rail_stop, s.stop_id AS bus_stop,
           CASE WHEN d.dist > 402 THEN (ceil(d.dist / 80.47) * 60)::int ELSE 0 END AS walk_sec,
           d.dist AS dist_m
    FROM rail_targets rt
    JOIN stops stn ON stn.stop_id = rt.xfer_stop
    JOIN dest_route_stops drs ON true
    JOIN stops s ON s.stop_id = drs.stop_id
    CROSS JOIN LATERAL (SELECT gtfs_distance_m(stn.stop_lat, stn.stop_lon, s.stop_lat, s.stop_lon) AS dist) d
    WHERE s.stop_lat BETWEEN stn.stop_lat - 0.02 AND stn.stop_lat + 0.02
      AND s.stop_lon BETWEEN stn.stop_lon - 0.02 AND stn.stop_lon + 0.02
      AND d.dist <= p_transfer_radius_m
  ),
  bus_legs AS MATERIALIZED (
    SELECT l.rail_stop, l.walk_sec AS xfer_walk_sec, l.dist_m AS xfer_walk_m,
           bs.stop_name AS b_stop_name, l.bus_stop AS b_stop_id,
           r2.route_short_name AS b_short, r2.route_long_name AS b_long,
           t2.trip_headsign AS b_headsign,
           gtfs_seconds(b.departure_time) AS b_dep_sec,
           arr.b_arr_sec, arr.d_stop_name, arr.d_stop_id, arr.d_walk_sec,
           arr.b_arr_sec + arr.d_walk_sec AS door_sec
    FROM links l
    JOIN stops bs ON bs.stop_id = l.bus_stop
    JOIN stop_times b ON b.stop_id = l.bus_stop
    JOIN trips t2 ON t2.trip_id = b.trip_id
    JOIN routes r2 ON r2.route_id = t2.route_id
    CROSS JOIN LATERAL (
      SELECT gtfs_seconds(dst.arrival_time) AS b_arr_sec, dc.stop_name AS d_stop_name,
             dc.stop_id AS d_stop_id, dc.walk_sec AS d_walk_sec
      FROM stop_times dst
      JOIN dest_cands dc ON dc.stop_id = dst.stop_id
      WHERE dst.trip_id = b.trip_id AND dst.stop_sequence > b.stop_sequence
      ORDER BY gtfs_seconds(dst.arrival_time) + dc.walk_sec
      LIMIT 1
    ) arr
    WHERE (t2.route_id, coalesce(t2.direction_id, 0))
            IN (SELECT route_id, direction_id FROM dest_routes)
      AND t2.service_id IN (SELECT service_id FROM active)
      AND gtfs_seconds(b.departure_time) BETWEEN (SELECT lo FROM win) AND (SELECT hi FROM win)
  ),
  chained AS MATERIALIZED (
    SELECT ar.*, leg.*
    FROM arrivals ar
    CROSS JOIN LATERAL (
      SELECT bl.b_short, bl.b_long, bl.b_headsign, bl.b_stop_name, bl.b_stop_id, bl.b_dep_sec,
             bl.b_arr_sec, bl.d_stop_name, bl.d_stop_id, bl.d_walk_sec, bl.door_sec,
             bl.xfer_walk_sec, bl.xfer_walk_m
      FROM bus_legs bl
      WHERE bl.rail_stop = ar.xfer_stop
        AND bl.b_dep_sec >= ar.xfer_sec + p_transfer_buffer_seconds + bl.xfer_walk_sec
      ORDER BY bl.door_sec, bl.b_dep_sec
      LIMIT 1
    ) leg
  ),
  best AS (
    SELECT DISTINCT ON (dep_sec) * FROM chained ORDER BY dep_sec, door_sec
  ),
  withaccess AS (
    SELECT b.*, pick.*
    FROM best b
    CROSS JOIN LATERAL (
      SELECT a.mode AS a_mode, a.route_short_name AS a_short, a.route_long_name AS a_long,
             a.headsign AS a_headsign, a.from_stop_name AS a_from, a.to_stop_name AS a_to,
             a.from_stop_id AS a_from_id, a.to_stop_id AS a_to_id,
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
  ),
  ranked AS (
    SELECT DISTINCT ON (door_sec) * FROM withaccess ORDER BY door_sec, a_leave_by DESC
  )
  SELECT w.a_leave_by, w.dep_sec, w.door_sec,
         ((w.door_sec - w.a_leave_by) / 60)::int,
         w.trip_id,
         jsonb_build_array(
           jsonb_build_object('kind','access','mode',w.a_mode,'route_short',w.a_short,
             'route_long',w.a_long,'headsign',w.a_headsign,'from',w.a_from,'to',w.a_to,
             'from_stop_id',w.a_from_id,'to_stop_id',w.a_to_id,
             'depart_seconds',coalesce(w.a_board, w.a_leave_by),'arrive_seconds',w.a_arrive,'minutes',w.a_minutes),
           jsonb_build_object('kind','rail','mode','rail','route_short',w.route_short_name,
             'route_long',w.route_long_name,'headsign',w.trip_headsign,'from',w.stop_name,
             'to',(SELECT stop_name FROM stops WHERE stop_id = w.xfer_stop),
             'from_stop_id',p_station,'to_stop_id',w.xfer_stop,
             'depart_seconds',w.dep_sec,'arrive_seconds',w.xfer_sec,
             'minutes',((w.xfer_sec - w.dep_sec)/60)::int)
         )
         || CASE WHEN w.xfer_walk_sec > 0 THEN jsonb_build_array(
              jsonb_build_object('kind','connect','mode','walk','route_short',NULL,
                'route_long',NULL,'headsign',NULL,
                'from',(SELECT stop_name FROM stops WHERE stop_id = w.xfer_stop),
                'to',w.b_stop_name,
                'from_stop_id',w.xfer_stop,'to_stop_id',w.b_stop_id,
                'depart_seconds',w.xfer_sec,'arrive_seconds',w.xfer_sec + w.xfer_walk_sec,
                'minutes',(w.xfer_walk_sec/60)::int)
            ) ELSE '[]'::jsonb END
         || jsonb_build_array(
           jsonb_build_object('kind','connect','mode','bus','route_short',w.b_short,
             'route_long',w.b_long,'headsign',w.b_headsign,'from',w.b_stop_name,
             'to',w.d_stop_name,
             'from_stop_id',w.b_stop_id,'to_stop_id',w.d_stop_id,
             'depart_seconds',w.b_dep_sec,'arrive_seconds',w.b_arr_sec,
             'minutes',((w.b_arr_sec - w.b_dep_sec)/60)::int)
         )
         || CASE WHEN w.d_walk_sec > 0 THEN jsonb_build_array(
              jsonb_build_object('kind','egress','mode','walk','route_short',NULL,
                'route_long',NULL,'headsign',NULL,
                'from',w.d_stop_name,'to','Your destination',
                'from_stop_id',w.d_stop_id,'to_stop_id',NULL,
                'depart_seconds',w.b_arr_sec,'arrive_seconds',w.door_sec,
                'minutes',(w.d_walk_sec/60)::int)
            ) ELSE '[]'::jsonb END
  FROM ranked w
  ORDER BY w.door_sec, w.a_leave_by DESC
  LIMIT p_limit;
$function$;

GRANT EXECUTE ON FUNCTION public.access_legs(numeric, numeric, text, boolean, integer, integer, integer, integer, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.egress_legs(text, numeric, numeric, boolean, integer, integer, integer, integer, integer) TO anon, authenticated, service_role;
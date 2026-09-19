-- Transfer radius 0.75 mile (1207 m); walking time between a connecting stop and
-- the rail station counts toward the chain when it is over a quarter mile (402 m).

-- access_legs / egress_legs already add the stop-to-station walk into their totals;
-- only the search radius widens.
CREATE OR REPLACE FUNCTION public.access_legs(p_lat numeric, p_lon numeric, p_station text DEFAULT NULL::text, p_allow_drive boolean DEFAULT false, p_earliest integer DEFAULT 0, p_window_sec integer DEFAULT 10800, p_walk_radius_m integer DEFAULT 1207, p_board_radius_m integer DEFAULT 805, p_station_radius_m integer DEFAULT 1207)
 RETURNS TABLE(mode text, station_stop text, station_name text, route_id text, route_short_name text, route_long_name text, headsign text, from_stop_name text, to_stop_name text, board_seconds integer, arrive_seconds integer, leave_by_seconds integer, minutes integer)
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
           ns.stop_id AS near_stop,
           -- Only a transfer walk over a quarter mile costs time.
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
$function$;

-- Outbound chain: wider transfer radius plus an explicit walking leg between the
-- rail station and the connecting stop when they are more than a quarter mile apart.
CREATE OR REPLACE FUNCTION public.plan_outbound(p_origin_lat numeric, p_origin_lon numeric, p_station text, p_dest_stop text, p_allow_drive boolean DEFAULT false, p_after_seconds integer DEFAULT NULL::integer, p_limit integer DEFAULT 4, p_bus_route_id text DEFAULT NULL::text, p_transfer_buffer_seconds integer DEFAULT 240, p_transfer_radius_m integer DEFAULT 1207)
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
           CASE WHEN n.dist_m > 402 THEN (ceil(n.dist_m / 80.47) * 60)::int ELSE 0 END AS walk_sec,
           n.dist_m
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
             gtfs_seconds(dst.arrival_time) AS b_arr_sec,
             l.walk_sec AS xfer_walk_sec, l.dist_m AS xfer_walk_m
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
             'minutes',((w.xfer_sec - w.dep_sec)/60)::int)
         )
         || CASE WHEN w.xfer_walk_sec > 0 THEN jsonb_build_array(
              jsonb_build_object('kind','connect','mode','walk','route_short',NULL,
                'route_long',NULL,'headsign',NULL,
                'from',(SELECT stop_name FROM stops WHERE stop_id = w.xfer_stop),
                'to',w.b_stop_name,
                'depart_seconds',w.xfer_sec,'arrive_seconds',w.xfer_sec + w.xfer_walk_sec,
                'minutes',(w.xfer_walk_sec/60)::int)
            ) ELSE '[]'::jsonb END
         || jsonb_build_array(
           jsonb_build_object('kind','connect','mode','bus','route_short',w.b_short,
             'route_long',w.b_long,'headsign',w.b_headsign,'from',w.b_stop_name,
             'to',(SELECT stop_name FROM stops WHERE stop_id = p_dest_stop),
             'depart_seconds',w.b_dep_sec,'arrive_seconds',w.b_arr_sec,
             'minutes',((w.b_arr_sec - w.b_dep_sec)/60)::int)
         )
  FROM withaccess w
  ORDER BY w.a_leave_by
  LIMIT p_limit;
$function$;

-- Legacy chain helper keeps the same wider radius for consistency.
CREATE OR REPLACE FUNCTION public.plan_rail_chains(p_home_stop text, p_dest_stop text, p_after_seconds integer DEFAULT NULL::integer, p_limit integer DEFAULT 4, p_bus_route_id text DEFAULT NULL::text, p_transfer_buffer_seconds integer DEFAULT 240, p_transfer_radius_m integer DEFAULT 1207)
 RETURNS TABLE(rail_trip_id text, rail_route_long_name text, rail_route_short_name text, rail_headsign text, home_stop_name text, depart_time text, depart_seconds integer, transfer_stop_id text, transfer_stop_name text, rail_arrive_time text, rail_arrive_seconds integer, bus_route_id text, bus_route_short_name text, bus_route_long_name text, bus_headsign text, bus_stop_name text, bus_depart_time text, bus_depart_seconds integer, dest_stop_name text, arrive_time text, arrive_seconds integer, total_minutes integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT c.*
  FROM (
    SELECT p.rail_trip_id, NULL::text, NULL::text, NULL::text, NULL::text, NULL::text,
           p.depart_seconds, NULL::text, NULL::text, NULL::text, NULL::int,
           NULL::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::int,
           NULL::text, NULL::text, p.arrive_seconds, p.total_minutes
    FROM plan_outbound(
      (SELECT stop_lat FROM stops WHERE stop_id = p_home_stop),
      (SELECT stop_lon FROM stops WHERE stop_id = p_home_stop),
      p_home_stop, p_dest_stop, false, p_after_seconds, p_limit, p_bus_route_id,
      p_transfer_buffer_seconds, p_transfer_radius_m) p
  ) c;
$function$;

-- Same multi-destination-stop logic, restructured so the wider candidate set stays fast:
-- rail transfer stops come from the actual departures, and connecting bus legs are
-- computed once inside a time window instead of once per departure.
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
  p_transfer_radius_m integer DEFAULT 1207,
  p_dest_lat numeric DEFAULT NULL,
  p_dest_lon numeric DEFAULT NULL,
  p_dest_radius_m integer DEFAULT 402
)
RETURNS TABLE(
  leave_by_seconds integer, depart_seconds integer, arrive_seconds integer,
  total_minutes integer, rail_trip_id text, legs jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
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
    LIMIT 12
  ),
  arrivals AS MATERIALIZED (
    SELECT d.*, a.stop_id AS xfer_stop, gtfs_seconds(a.arrival_time) AS xfer_sec
    FROM departures d
    JOIN stop_times a ON a.trip_id = d.trip_id AND a.stop_sequence > d.stop_sequence
  ),
  win AS MATERIALIZED (
    SELECT min(xfer_sec) AS lo, max(xfer_sec) + 5400 AS hi FROM arrivals
  ),
  -- Every stop a short walk from the destination is a valid place to get off.
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
    SELECT DISTINCT r.route_id
    FROM dest_cands dc
    JOIN stop_times st ON st.stop_id = dc.stop_id
    JOIN trips t ON t.trip_id = st.trip_id
    JOIN routes r ON r.route_id = t.route_id
    WHERE r.route_type <> 1
      AND t.service_id IN (SELECT service_id FROM active)
      AND (p_bus_route_id IS NULL OR r.route_id = p_bus_route_id)
  ),
  -- Only the rail stops these trains actually reach can be transfer points.
  rail_targets AS MATERIALIZED (SELECT DISTINCT xfer_stop FROM arrivals),
  links AS MATERIALIZED (
    SELECT rt.xfer_stop AS rail_stop, s.stop_id AS bus_stop,
           CASE WHEN d.dist > 402 THEN (ceil(d.dist / 80.47) * 60)::int ELSE 0 END AS walk_sec,
           d.dist AS dist_m
    FROM rail_targets rt
    JOIN stops stn ON stn.stop_id = rt.xfer_stop
    JOIN stops s
      ON s.stop_lat BETWEEN stn.stop_lat - 0.02 AND stn.stop_lat + 0.02
     AND s.stop_lon BETWEEN stn.stop_lon - 0.02 AND stn.stop_lon + 0.02
    CROSS JOIN LATERAL (SELECT gtfs_distance_m(stn.stop_lat, stn.stop_lon, s.stop_lat, s.stop_lon) AS dist) d
    WHERE d.dist <= p_transfer_radius_m
  ),
  -- Connecting bus legs, computed once for the whole transfer window.
  bus_legs AS MATERIALIZED (
    SELECT l.rail_stop, l.walk_sec AS xfer_walk_sec, l.dist_m AS xfer_walk_m,
           bs.stop_name AS b_stop_name,
           r2.route_short_name AS b_short, r2.route_long_name AS b_long,
           t2.trip_headsign AS b_headsign,
           gtfs_seconds(b.departure_time) AS b_dep_sec,
           arr.b_arr_sec, arr.d_stop_name, arr.d_walk_sec,
           arr.b_arr_sec + arr.d_walk_sec AS door_sec
    FROM links l
    JOIN stops bs ON bs.stop_id = l.bus_stop
    JOIN stop_times b ON b.stop_id = l.bus_stop
    JOIN trips t2 ON t2.trip_id = b.trip_id
    JOIN routes r2 ON r2.route_id = t2.route_id
    CROSS JOIN LATERAL (
      SELECT gtfs_seconds(dst.arrival_time) AS b_arr_sec, dc.stop_name AS d_stop_name,
             dc.walk_sec AS d_walk_sec
      FROM stop_times dst
      JOIN dest_cands dc ON dc.stop_id = dst.stop_id
      WHERE dst.trip_id = b.trip_id AND dst.stop_sequence > b.stop_sequence
      -- Fastest to the door, walk included, not merely the fastest bus.
      ORDER BY gtfs_seconds(dst.arrival_time) + dc.walk_sec
      LIMIT 1
    ) arr
    WHERE t2.route_id IN (SELECT route_id FROM dest_routes)
      AND t2.service_id IN (SELECT service_id FROM active)
      AND gtfs_seconds(b.departure_time) BETWEEN (SELECT lo FROM win) AND (SELECT hi FROM win)
  ),
  chained AS MATERIALIZED (
    SELECT ar.*, leg.*
    FROM arrivals ar
    CROSS JOIN LATERAL (
      SELECT bl.b_short, bl.b_long, bl.b_headsign, bl.b_stop_name, bl.b_dep_sec,
             bl.b_arr_sec, bl.d_stop_name, bl.d_walk_sec, bl.door_sec,
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
  SELECT w.a_leave_by, w.dep_sec, w.door_sec,
         ((w.door_sec - w.a_leave_by) / 60)::int,
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
             'to',w.d_stop_name,
             'depart_seconds',w.b_dep_sec,'arrive_seconds',w.b_arr_sec,
             'minutes',((w.b_arr_sec - w.b_dep_sec)/60)::int)
         )
         || CASE WHEN w.d_walk_sec > 0 THEN jsonb_build_array(
              jsonb_build_object('kind','egress','mode','walk','route_short',NULL,
                'route_long',NULL,'headsign',NULL,
                'from',w.d_stop_name,'to','Your destination',
                'depart_seconds',w.b_arr_sec,'arrive_seconds',w.door_sec,
                'minutes',(w.d_walk_sec/60)::int)
            ) ELSE '[]'::jsonb END
  FROM withaccess w
  ORDER BY w.a_leave_by
  LIMIT p_limit;
$function$;
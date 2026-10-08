-- Side by side for migration 0065 (plan_outbound_multi), production rehearsal.
-- Creates the combined search as plan_outbound_multi_preview, callable only by
-- the database owner (the Management API), so riders and the app never use it.
-- Then run: SUPABASE_ACCESS_TOKEN=... bun scripts/db-speed/compare-outbound.mts --api
-- Generated from drizzle/migrations/0065_plan_outbound_multi.sql (function
-- renamed, grants removed); regenerate with the command in README.md if 0065 changes.
CREATE OR REPLACE FUNCTION public.plan_outbound_multi_preview(
  p_origin_lat numeric,
  p_origin_lon numeric,
  p_stations text[],
  p_allow_drive boolean[],
  p_limits integer[],
  p_dest_stop text,
  p_after_seconds integer DEFAULT NULL::integer,
  p_bus_route_id text DEFAULT NULL::text,
  p_transfer_buffer_seconds integer DEFAULT 240,
  p_transfer_radius_m integer DEFAULT 1207,
  p_dest_lat numeric DEFAULT NULL::numeric,
  p_dest_lon numeric DEFAULT NULL::numeric,
  p_dest_radius_m integer DEFAULT 402)
 RETURNS TABLE(station_index integer, station text, leave_by_seconds integer, depart_seconds integer, arrive_seconds integer, total_minutes integer, rail_trip_id text, legs jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET plan_cache_mode TO 'force_generic_plan'
AS $function$
DECLARE
  v_n integer := coalesce(cardinality(p_stations), 0);
  v_i integer;
  v_acc jsonb;
  v_arrivals jsonb;
  v_after integer;
  v_station text;
  acc_rows jsonb[] := '{}';
  arrival_rows jsonb[] := '{}';
  all_arrivals jsonb := '[]'::jsonb;
  shared_dest jsonb;
  shared_bus_legs jsonb;
BEGIN
  IF v_n = 0 OR v_n > 8
     OR array_ndims(p_stations) <> 1 OR array_ndims(p_allow_drive) <> 1
     OR array_ndims(p_limits) <> 1
     OR coalesce(cardinality(p_allow_drive), 0) <> v_n
     OR coalesce(cardinality(p_limits), 0) <> v_n THEN
    RAISE EXCEPTION 'plan_outbound_multi_preview: 1-8 stations, one allow-drive flag and one limit each'
      USING ERRCODE = '22023';
  END IF;

  -- plan_outbound's v: one clock reading for the whole search (now() is fixed
  -- for the transaction, as it is for back-to-back separate calls' purposes).
  v_after := coalesce(
    p_after_seconds,
    extract(hour FROM now() AT TIME ZONE 'Pacific/Honolulu')::int * 3600
      + extract(minute FROM now() AT TIME ZONE 'Pacific/Honolulu')::int * 60
  );

  -- Pass 1, per station: access legs and the trains caught (plan_outbound's
  -- acc .. arrivals, unchanged), kept in their original order.
  FOR v_i IN 1..v_n LOOP
    v_station := p_stations[v_i];
    WITH v AS MATERIALIZED (
      SELECT v_after AS after_sec
    ),
    active AS MATERIALIZED (SELECT DISTINCT a.service_id FROM active_service_ids() a),
    acc AS MATERIALIZED (
      SELECT a.*,
             CASE WHEN a.arrive_seconds IS NULL
                  THEN (SELECT after_sec FROM v) + a.minutes * 60
                  ELSE a.arrive_seconds + 120 END AS ready_sec
      FROM access_legs(p_origin_lat, p_origin_lon, v_station, p_allow_drive[v_i],
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
      WHERE st.stop_id = v_station
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
    )
    SELECT
      coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.ord)
                FROM (SELECT acc.*, row_number() OVER () AS ord FROM acc) x), '[]'::jsonb),
      coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.ord)
                FROM (SELECT arrivals.*, row_number() OVER () AS ord FROM arrivals) x), '[]'::jsonb)
    INTO v_acc, v_arrivals;
    acc_rows[v_i] := v_acc;
    arrival_rows[v_i] := v_arrivals;
    all_arrivals := all_arrivals || arrival_rows[v_i];
  END LOOP;

  -- Pass 2, once: destination stops and the buses from every station's
  -- transfer stops toward them (plan_outbound's dest_cands .. bus_legs), over
  -- the union of the stations' transfer stops and time windows.
  --
  -- Row order matters: when the same bus leaves two nearby stops at the same
  -- second, plan_outbound's "best connection" (ORDER BY door_sec, b_dep_sec
  -- LIMIT 1) keeps whichever row it meets first. plan_outbound's plan (on SSD
  -- cost settings, random_page_cost 1.1 as on Supabase) builds bus_legs by a
  -- merge join on the bus stop id, then each stop's departures in
  -- stop_times_stop_departure_idx order (departure_time, then row). The rows
  -- are handed on in that same order, so every tie resolves the same way.
  -- The production side-by-side (scripts/db-speed) proves it on the live plan.
  WITH active AS MATERIALIZED (SELECT DISTINCT a.service_id FROM active_service_ids() a),
  arrivals AS MATERIALIZED (
    SELECT * FROM jsonb_to_recordset(all_arrivals)
      AS x(trip_id text, stop_sequence integer, dep_sec integer, route_long_name text,
           route_short_name text, trip_headsign text, stop_name text, xfer_stop text,
           xfer_sec integer)
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
           arr.b_arr_sec + arr.d_walk_sec AS door_sec,
           b.departure_time AS b_dep_text, b.ctid AS b_row
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
  )
  SELECT
    coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.ord)
              FROM (SELECT dest_cands.*, row_number() OVER () AS ord FROM dest_cands) x), '[]'::jsonb),
    coalesce((SELECT jsonb_agg(jsonb_build_object(
                'rail_stop', bl.rail_stop, 'xfer_walk_sec', bl.xfer_walk_sec,
                'xfer_walk_m', bl.xfer_walk_m, 'b_stop_name', bl.b_stop_name,
                'b_stop_id', bl.b_stop_id, 'b_short', bl.b_short, 'b_long', bl.b_long,
                'b_headsign', bl.b_headsign, 'b_dep_sec', bl.b_dep_sec,
                'b_arr_sec', bl.b_arr_sec, 'd_stop_name', bl.d_stop_name,
                'd_stop_id', bl.d_stop_id, 'd_walk_sec', bl.d_walk_sec, 'door_sec', bl.door_sec)
              ORDER BY bl.b_stop_id, bl.b_dep_text, bl.b_row)
              FROM bus_legs bl), '[]'::jsonb)
  INTO shared_dest, shared_bus_legs;

  -- Pass 3, per station: plan_outbound's direct_rail .. final SELECT, unchanged,
  -- with bus_legs limited to this station's own window.
  FOR v_i IN 1..v_n LOOP
    v_station := p_stations[v_i];
    RETURN QUERY
    WITH acc AS MATERIALIZED (
      SELECT * FROM jsonb_to_recordset(acc_rows[v_i])
        AS x(mode text, station_stop text, station_name text, route_id text,
             route_short_name text, route_long_name text, headsign text,
             from_stop_name text, to_stop_name text, board_seconds integer,
             arrive_seconds integer, leave_by_seconds integer, minutes integer,
             from_stop_id text, to_stop_id text, ready_sec integer)
    ),
    arrivals AS MATERIALIZED (
      SELECT * FROM jsonb_to_recordset(arrival_rows[v_i])
        AS x(trip_id text, stop_sequence integer, dep_sec integer, route_long_name text,
             route_short_name text, trip_headsign text, stop_name text, xfer_stop text,
             xfer_sec integer)
    ),
    win AS MATERIALIZED (
      SELECT min(xfer_sec) AS lo, max(xfer_sec) + 3600 AS hi FROM arrivals
    ),
    dest_cands AS MATERIALIZED (
      SELECT * FROM jsonb_to_recordset(shared_dest)
        AS x(stop_id text, stop_name text, walk_sec integer)
    ),
    bus_legs AS MATERIALIZED (
      SELECT x.rail_stop, x.xfer_walk_sec, x.xfer_walk_m, x.b_stop_name, x.b_stop_id,
             x.b_short, x.b_long, x.b_headsign, x.b_dep_sec, x.b_arr_sec,
             x.d_stop_name, x.d_stop_id, x.d_walk_sec, x.door_sec
      FROM jsonb_to_recordset(shared_bus_legs)
        AS x(rail_stop text, xfer_walk_sec integer, xfer_walk_m double precision,
             b_stop_name text, b_stop_id text, b_short text, b_long text, b_headsign text,
             b_dep_sec integer, b_arr_sec integer, d_stop_name text, d_stop_id text,
             d_walk_sec integer, door_sec integer)
      WHERE x.rail_stop IN (SELECT xfer_stop FROM arrivals)
        AND x.b_dep_sec BETWEEN (SELECT lo FROM win) AND (SELECT hi FROM win)
    ),
    direct_rail AS MATERIALIZED (
      SELECT ar.trip_id, ar.stop_sequence, ar.dep_sec, ar.route_long_name,
             ar.route_short_name, ar.trip_headsign, ar.stop_name,
             ar.xfer_stop, ar.xfer_sec,
             dc.stop_name AS d_stop_name, dc.stop_id AS d_stop_id,
             dc.walk_sec AS d_walk_sec,
             ar.xfer_sec + dc.walk_sec AS door_sec
      FROM arrivals ar
      JOIN dest_cands dc ON dc.stop_id = ar.xfer_stop
    ),
    chained AS MATERIALIZED (
      SELECT ar.trip_id, ar.stop_sequence, ar.dep_sec, ar.route_long_name,
             ar.route_short_name, ar.trip_headsign, ar.stop_name,
             ar.xfer_stop, ar.xfer_sec,
             leg.b_short, leg.b_long, leg.b_headsign, leg.b_stop_name, leg.b_stop_id,
             leg.b_dep_sec, leg.b_arr_sec, leg.d_stop_name, leg.d_stop_id,
             leg.d_walk_sec, leg.door_sec, leg.xfer_walk_sec, leg.xfer_walk_m
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
      UNION ALL
      SELECT dr.trip_id, dr.stop_sequence, dr.dep_sec, dr.route_long_name,
             dr.route_short_name, dr.trip_headsign, dr.stop_name,
             dr.xfer_stop, dr.xfer_sec,
             NULL::text, NULL::text, NULL::text, NULL::text, NULL::text,
             NULL::integer, NULL::integer, dr.d_stop_name, dr.d_stop_id,
             dr.d_walk_sec, dr.door_sec, 0::integer, 0::numeric
      FROM direct_rail dr
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
    SELECT v_i, v_station,
           w.a_leave_by, w.dep_sec, w.door_sec,
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
               'from_stop_id',v_station,'to_stop_id',w.xfer_stop,
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
           || CASE WHEN w.b_dep_sec IS NOT NULL THEN jsonb_build_array(
                jsonb_build_object('kind','connect','mode','bus','route_short',w.b_short,
                  'route_long',w.b_long,'headsign',w.b_headsign,'from',w.b_stop_name,
                  'to',w.d_stop_name,
                  'from_stop_id',w.b_stop_id,'to_stop_id',w.d_stop_id,
                  'depart_seconds',w.b_dep_sec,'arrive_seconds',w.b_arr_sec,
                  'minutes',((w.b_arr_sec - w.b_dep_sec)/60)::int)
              ) ELSE '[]'::jsonb END
           || CASE WHEN w.d_walk_sec > 0 THEN jsonb_build_array(
                jsonb_build_object('kind','egress','mode','walk','route_short',NULL,
                  'route_long',NULL,'headsign',NULL,
                  'from',CASE WHEN w.b_dep_sec IS NULL
                    THEN (SELECT stop_name FROM stops WHERE stop_id = w.xfer_stop)
                    ELSE w.d_stop_name END,
                  'to','Your destination',
                  'from_stop_id',CASE WHEN w.b_dep_sec IS NULL THEN w.xfer_stop ELSE w.d_stop_id END,
                  'to_stop_id',NULL,
                  'depart_seconds',CASE WHEN w.b_dep_sec IS NULL THEN w.xfer_sec ELSE w.b_arr_sec END,
                  'arrive_seconds',w.door_sec,
                  'minutes',(w.d_walk_sec/60)::int)
              ) ELSE '[]'::jsonb END
    FROM ranked w
    ORDER BY w.door_sec, w.a_leave_by DESC
    LIMIT p_limits[v_i];
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.plan_outbound_multi_preview(numeric, numeric, text[], boolean[], integer[], text, integer, text, integer, integer, numeric, numeric, integer) FROM PUBLIC, anon, authenticated, service_role;

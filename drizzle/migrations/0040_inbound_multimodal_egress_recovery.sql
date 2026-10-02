-- Inbound multimodal recovery: allow a realistic last-mile bus/walk connection
-- when the destination is just outside the original 800m point / 400m station
-- search window. Strict access and rail matching remain unchanged.
-- This is deliberately scoped to inbound trips so a residential home such as
-- 91-1160 Kamakana Street can use Skyline + TheBus when the final stop is a
-- little farther from the saved door than the original planner allowed.

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
      (SELECT coalesce(min(arr_sec), 0) FROM rides),
      7200, 1200, 1200, 600
    )
  ),
  withlegs AS (
    SELECT r.*, a.*, e.*
    FROM rides r
    CROSS JOIN LATERAL (
      SELECT ac.mode AS a_mode, ac.route_short_name AS a_short, ac.route_long_name AS a_long,
             ac.headsign AS a_headsign, ac.from_stop_name AS a_from, ac.to_stop_name AS a_to,
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
  ORDER BY w.score, w.e_arrive
  LIMIT p_limit;
$$;
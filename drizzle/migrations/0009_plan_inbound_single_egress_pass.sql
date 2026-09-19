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
                ELSE a.arrive_seconds + 120 END AS ready_sec
    FROM access_legs(p_dest_lat, p_dest_lon, NULL, false, (SELECT after_sec FROM v)) a
    WHERE a.station_stop <> p_station
  ),
  stations AS MATERIALIZED (
    SELECT station_stop, min(ready_sec) AS ready_sec FROM acc GROUP BY station_stop
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
    LIMIT 8
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
             ac.minutes AS a_minutes, ac.board_seconds AS a_board,
             CASE WHEN ac.arrive_seconds IS NULL THEN r.dep_sec - ac.minutes * 60
                  ELSE ac.leave_by_seconds END AS a_leave_by,
             CASE WHEN ac.arrive_seconds IS NULL THEN r.dep_sec ELSE ac.arrive_seconds END AS a_arrive
      FROM acc ac
      WHERE ac.station_stop = r.station_stop AND ac.ready_sec <= r.dep_sec
      ORDER BY CASE WHEN ac.arrive_seconds IS NULL THEN r.dep_sec - ac.minutes * 60
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
  best AS (
    SELECT DISTINCT ON (a_leave_by) * FROM withlegs ORDER BY a_leave_by, e_arrive
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
  ORDER BY w.a_leave_by
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.plan_inbound(numeric, numeric, text, numeric, numeric, boolean, integer, integer, integer) TO anon, authenticated, service_role;
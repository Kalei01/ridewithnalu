CREATE OR REPLACE FUNCTION public.leg_stop_sequence(
  p_from_name text,
  p_to_name text,
  p_depart_seconds integer,
  p_route_short text DEFAULT NULL,
  p_rail boolean DEFAULT false,
  p_tolerance_seconds integer DEFAULT 120
)
RETURNS TABLE(
  stop_id text,
  stop_name text,
  stop_lat numeric,
  stop_lon numeric,
  stop_sequence integer,
  arrival_seconds integer,
  departure_seconds integer,
  is_board boolean,
  is_alight boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  WITH active AS MATERIALIZED (
    SELECT DISTINCT a.service_id FROM active_service_ids() a
  ),
  board AS MATERIALIZED (
    SELECT st.trip_id, st.stop_sequence AS board_seq,
           gtfs_seconds(st.departure_time) AS dep_sec
    FROM stop_times st
    JOIN trips t ON t.trip_id = st.trip_id
    JOIN routes r ON r.route_id = t.route_id
    JOIN stops s ON s.stop_id = st.stop_id
    WHERE s.stop_name = p_from_name
      AND t.service_id IN (SELECT service_id FROM active)
      AND (CASE WHEN p_rail THEN r.route_type = 1
                ELSE r.route_type <> 1
                     AND (p_route_short IS NULL OR r.route_short_name = p_route_short) END)
      AND abs(gtfs_seconds(st.departure_time) - p_depart_seconds) <= p_tolerance_seconds
    ORDER BY abs(gtfs_seconds(st.departure_time) - p_depart_seconds)
    LIMIT 8
  ),
  matched AS MATERIALIZED (
    SELECT b.trip_id, b.board_seq, a.alight_seq
    FROM board b
    CROSS JOIN LATERAL (
      SELECT st.stop_sequence AS alight_seq
      FROM stop_times st
      JOIN stops s ON s.stop_id = st.stop_id
      WHERE st.trip_id = b.trip_id
        AND st.stop_sequence > b.board_seq
        AND s.stop_name = p_to_name
      ORDER BY st.stop_sequence
      LIMIT 1
    ) a
    ORDER BY abs(b.dep_sec - p_depart_seconds)
    LIMIT 1
  )
  SELECT st.stop_id, s.stop_name, s.stop_lat, s.stop_lon, st.stop_sequence,
         gtfs_seconds(st.arrival_time) AS arrival_seconds,
         gtfs_seconds(st.departure_time) AS departure_seconds,
         st.stop_sequence = m.board_seq AS is_board,
         st.stop_sequence = m.alight_seq AS is_alight
  FROM matched m
  JOIN stop_times st ON st.trip_id = m.trip_id
                    AND st.stop_sequence BETWEEN m.board_seq AND m.alight_seq
  JOIN stops s ON s.stop_id = st.stop_id
  ORDER BY st.stop_sequence
$function$;

GRANT EXECUTE ON FUNCTION public.leg_stop_sequence(text, text, integer, text, boolean, integer)
  TO anon, authenticated, service_role;

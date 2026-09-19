-- Keep departure selection and ordering unchanged while adding a canonical,
-- data-derived line endpoint and scheduled ride duration for each direction.
DROP FUNCTION IF EXISTS public.rail_departures(text, integer, integer);

CREATE FUNCTION public.rail_departures(
  p_home_stop text,
  p_after_seconds integer DEFAULT NULL,
  p_limit integer DEFAULT 3
)
RETURNS TABLE(
  trip_id text,
  route_id text,
  route_long_name text,
  route_short_name text,
  trip_headsign text,
  direction_id integer,
  stop_name text,
  departure_time text,
  departure_seconds integer,
  direction_terminus text,
  ride_minutes integer,
  terminus_lon numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH params AS (
    SELECT coalesce(
      p_after_seconds,
      extract(hour FROM now() AT TIME ZONE 'Pacific/Honolulu')::int * 3600
        + extract(minute FROM now() AT TIME ZONE 'Pacific/Honolulu')::int * 60
    ) AS after_seconds
  ),
  candidates AS MATERIALIZED (
    SELECT t.trip_id, r.route_id, r.route_long_name, r.route_short_name,
           t.trip_headsign, t.direction_id, s.stop_name, st.departure_time,
           gtfs_seconds(st.departure_time) AS departure_seconds,
           (SELECT count(*) FROM stop_times st_after
             WHERE st_after.trip_id = st.trip_id
               AND st_after.stop_sequence > st.stop_sequence) AS onward_stops
    FROM stop_times st
    JOIN trips t ON t.trip_id = st.trip_id
    JOIN routes r ON r.route_id = t.route_id
    JOIN stops s ON s.stop_id = st.stop_id
    CROSS JOIN params p
    WHERE st.stop_id = p_home_stop
      AND r.route_type = 1
      AND t.service_id IN (SELECT a.service_id FROM active_service_ids() a)
      AND gtfs_seconds(st.departure_time) >= p.after_seconds
      AND EXISTS (
        SELECT 1 FROM stop_times st_after
        WHERE st_after.trip_id = st.trip_id
          AND st_after.stop_sequence > st.stop_sequence
      )
  ),
  canonical_trips AS (
    SELECT DISTINCT ON (c.route_id, c.direction_id)
           c.route_id, c.direction_id, c.trip_id, c.trip_headsign AS heading,
           c.departure_seconds AS board_seconds
    FROM candidates c
    ORDER BY c.route_id, c.direction_id, c.onward_stops DESC, c.departure_seconds
  ),
  direction_context AS (
    SELECT ct.route_id, ct.direction_id, ct.heading,
           endpoint.stop_name AS direction_terminus,
           endpoint.stop_lon AS terminus_lon,
           greatest(0, round((endpoint.arrival_seconds - ct.board_seconds) / 60.0))::integer AS ride_minutes
    FROM canonical_trips ct
    JOIN LATERAL (
      SELECT s.stop_name, s.stop_lon,
             coalesce(gtfs_seconds(st.arrival_time), gtfs_seconds(st.departure_time)) AS arrival_seconds
      FROM stop_times st
      JOIN stops s ON s.stop_id = st.stop_id
      WHERE st.trip_id = ct.trip_id
        AND coalesce(gtfs_seconds(st.arrival_time), gtfs_seconds(st.departure_time)) IS NOT NULL
      ORDER BY st.stop_sequence DESC
      LIMIT 1
    ) endpoint ON true
  ),
  ranked AS (
    SELECT c.*, dc.heading, dc.direction_terminus, dc.ride_minutes, dc.terminus_lon,
           row_number() OVER (
             PARTITION BY c.route_id, c.direction_id
             ORDER BY c.departure_seconds, c.trip_id
           ) AS rn
    FROM candidates c
    JOIN direction_context dc
      ON dc.route_id = c.route_id
     AND dc.direction_id IS NOT DISTINCT FROM c.direction_id
  )
  SELECT ranked.trip_id, ranked.route_id, ranked.route_long_name, ranked.route_short_name,
         ranked.heading AS trip_headsign, ranked.direction_id, ranked.stop_name,
         ranked.departure_time, ranked.departure_seconds,
         ranked.direction_terminus, ranked.ride_minutes, ranked.terminus_lon
  FROM ranked
  WHERE ranked.rn <= greatest(p_limit, 1)
  ORDER BY ranked.direction_id, ranked.departure_seconds;
$$;

GRANT EXECUTE ON FUNCTION public.rail_departures(text, integer, integer) TO anon, authenticated, service_role;
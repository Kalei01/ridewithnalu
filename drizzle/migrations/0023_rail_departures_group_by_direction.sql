-- Directions are physical line directions (direction_id), not headsign variants.
-- Evening short-turns share a direction with the full-line runs, so they belong
-- in the same section under the canonical terminus heading.
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
  departure_seconds integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH params AS (
    SELECT coalesce(
      p_after_seconds,
      extract(hour FROM now() AT TIME ZONE 'Pacific/Honolulu')::int * 3600
        + extract(minute FROM now() AT TIME ZONE 'Pacific/Honolulu')::int * 60
    ) AS after_seconds
  ),
  -- Every rail departure from this stop that actually continues onward.
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
  -- Canonical heading per direction: the run that goes the furthest.
  headings AS (
    SELECT DISTINCT ON (c.route_id, c.direction_id)
           c.route_id, c.direction_id, c.trip_headsign AS heading
    FROM candidates c
    ORDER BY c.route_id, c.direction_id, c.onward_stops DESC, c.departure_seconds
  ),
  ranked AS (
    SELECT c.*, h.heading,
           row_number() OVER (
             PARTITION BY c.route_id, c.direction_id
             ORDER BY c.departure_seconds, c.trip_id
           ) AS rn
    FROM candidates c
    JOIN headings h ON h.route_id = c.route_id AND h.direction_id IS NOT DISTINCT FROM c.direction_id
  )
  SELECT ranked.trip_id, ranked.route_id, ranked.route_long_name, ranked.route_short_name,
         ranked.heading AS trip_headsign, ranked.direction_id, ranked.stop_name,
         ranked.departure_time, ranked.departure_seconds
  FROM ranked
  WHERE ranked.rn <= greatest(p_limit, 1)
  ORDER BY ranked.direction_id, ranked.departure_seconds;
$$;

GRANT EXECUTE ON FUNCTION public.rail_departures(text, integer, integer) TO anon, authenticated, service_role;
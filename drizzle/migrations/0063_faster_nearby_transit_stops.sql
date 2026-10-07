-- Faster "stops near me" (nearby_transit_stops).
--
-- The old version found which stops have bus or rail service by joining every
-- stop_times row in a ~13 km box (~634k rows downtown, ~4.9 s on production)
-- to keep the 7 nearest. stop_modes now remembers which kind of service
-- (route_type) calls at each stop, so the function only has to confirm that
-- today's service still calls at each candidate stop (one index probe each).
-- The answer is unchanged: same stops, same arrivals, same order.
--
-- stop_modes is rebuilt inside swap_gtfs_staging(), in the same transaction
-- as the weekly timetable swap, so it can never disagree with stop_times.
-- swap_gtfs_staging() is the only writer of the live GTFS tables.
--
-- Rollback: see the end of this file.

-- 1. Which service types (routes.route_type) call at each stop.
CREATE TABLE IF NOT EXISTS public.stop_modes (
  stop_id text NOT NULL,
  route_type integer NOT NULL,
  PRIMARY KEY (stop_id, route_type)
);
-- Read only through SECURITY DEFINER functions; no direct API access.
ALTER TABLE public.stop_modes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stop_modes FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.stop_modes TO service_role;

-- Derived data: rebuilt from the live feed, so safe to re-run.
TRUNCATE public.stop_modes;
INSERT INTO public.stop_modes (stop_id, route_type)
SELECT DISTINCT st.stop_id, r.route_type
FROM public.stop_times st
JOIN public.trips t ON t.trip_id = st.trip_id
JOIN public.routes r ON r.route_id = t.route_id
WHERE r.route_type IS NOT NULL;
ANALYZE public.stop_modes;

-- 2. The weekly swap rebuilds stop_modes with the new feed (same transaction).
--    Same as 0026 plus the stop_modes rebuild; keeps 0027's 900 s timeout.
CREATE OR REPLACE FUNCTION public.swap_gtfs_staging()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '900s'
AS $$
DECLARE
  result jsonb;
BEGIN
  IF (SELECT count(*) FROM staging_stop_times) = 0
     OR (SELECT count(*) FROM staging_stops) = 0
     OR (SELECT count(*) FROM staging_trips) = 0
     OR (SELECT count(*) FROM staging_calendar) = 0 THEN
    RAISE EXCEPTION 'staging incomplete: refusing to swap';
  END IF;

  -- One transaction: readers see the whole old feed or the whole new one.
  TRUNCATE stop_times, trips, calendar_dates, calendar, routes, stops, stop_modes;

  INSERT INTO stops SELECT * FROM staging_stops;
  INSERT INTO routes SELECT * FROM staging_routes;
  INSERT INTO calendar SELECT * FROM staging_calendar;
  INSERT INTO calendar_dates SELECT * FROM staging_calendar_dates;
  INSERT INTO trips SELECT * FROM staging_trips;
  INSERT INTO stop_times SELECT * FROM staging_stop_times;

  INSERT INTO stop_modes (stop_id, route_type)
  SELECT DISTINCT st.stop_id, r.route_type
  FROM stop_times st
  JOIN trips t ON t.trip_id = st.trip_id
  JOIN routes r ON r.route_id = t.route_id
  WHERE r.route_type IS NOT NULL;

  SELECT jsonb_build_object(
    'stops', (SELECT count(*) FROM stops),
    'routes', (SELECT count(*) FROM routes),
    'trips', (SELECT count(*) FROM trips),
    'calendar', (SELECT count(*) FROM calendar),
    'calendar_dates', (SELECT count(*) FROM calendar_dates),
    'stop_times', (SELECT count(*) FROM stop_times),
    'stop_modes', (SELECT count(*) FROM stop_modes)
  ) INTO result;

  TRUNCATE staging_stop_times, staging_trips, staging_calendar_dates,
           staging_calendar, staging_routes, staging_stops;

  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.swap_gtfs_staging() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.swap_gtfs_staging() TO service_role;

-- 3. nearby_transit_stops: candidates come from stop_modes; today's service is
--    confirmed per candidate with EXISTS. Everything from `ranked` on is
--    unchanged from 0030.
CREATE OR REPLACE FUNCTION public.nearby_transit_stops(
  p_lat numeric,
  p_lon numeric,
  p_after_seconds integer DEFAULT NULL,
  p_rail_limit integer DEFAULT 2,
  p_bus_limit integer DEFAULT 5
)
RETURNS TABLE(
  stop_id text,
  stop_name text,
  stop_lat numeric,
  stop_lon numeric,
  route_type integer,
  distance_m double precision,
  arrivals jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH active AS MATERIALIZED (
    SELECT DISTINCT a.service_id FROM public.active_service_ids() a
  ),
  served AS MATERIALIZED (
    SELECT s.stop_id, s.stop_name, s.stop_lat, s.stop_lon, m.route_type
    FROM public.stops s
    JOIN public.stop_modes m ON m.stop_id = s.stop_id
    WHERE s.stop_lat IS NOT NULL
      AND s.stop_lon IS NOT NULL
      AND m.route_type IN (1, 3)
      AND s.stop_lat BETWEEN p_lat - 0.06 AND p_lat + 0.06
      AND s.stop_lon BETWEEN p_lon - 0.06 AND p_lon + 0.06
      AND EXISTS (
        SELECT 1
        FROM public.stop_times st
        JOIN public.trips t ON t.trip_id = st.trip_id
        JOIN public.routes r ON r.route_id = t.route_id
        JOIN active a ON a.service_id = t.service_id
        WHERE st.stop_id = s.stop_id
          AND r.route_type = m.route_type
      )
  ),
  ranked AS MATERIALIZED (
    SELECT served.*,
      public.gtfs_distance_m(p_lat, p_lon, stop_lat, stop_lon) AS distance_m,
      row_number() OVER (
        PARTITION BY route_type
        ORDER BY public.gtfs_distance_m(p_lat, p_lon, stop_lat, stop_lon)
      ) AS proximity_rank
    FROM served
  ),
  chosen AS MATERIALIZED (
    SELECT * FROM ranked
    WHERE (route_type = 1 AND proximity_rank <= greatest(1, least(p_rail_limit, 4)))
       OR (route_type = 3 AND proximity_rank <= greatest(1, least(p_bus_limit, 8)))
  )
  SELECT c.stop_id, c.stop_name, c.stop_lat, c.stop_lon, c.route_type, c.distance_m,
    coalesce(next_arrivals.items, '[]'::jsonb) AS arrivals
  FROM chosen c
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object(
      'departure_seconds', d.departure_seconds,
      'departure_time', d.departure_time,
      'route_short_name', d.route_short_name,
      'route_long_name', d.route_long_name,
      'headsign', d.trip_headsign
    ) ORDER BY d.departure_seconds) AS items
    FROM (
      SELECT public.gtfs_seconds(st.departure_time) AS departure_seconds,
        st.departure_time,
        r.route_short_name,
        r.route_long_name,
        t.trip_headsign
      FROM public.stop_times st
      JOIN public.trips t ON t.trip_id = st.trip_id
      JOIN public.routes r ON r.route_id = t.route_id
      JOIN active a ON a.service_id = t.service_id
      WHERE st.stop_id = c.stop_id
        AND r.route_type = c.route_type
        AND public.gtfs_seconds(st.departure_time) >= coalesce(p_after_seconds,
          extract(hour from now() AT TIME ZONE 'Pacific/Honolulu')::int * 3600
          + extract(minute from now() AT TIME ZONE 'Pacific/Honolulu')::int * 60
          + extract(second from now() AT TIME ZONE 'Pacific/Honolulu')::int)
      ORDER BY public.gtfs_seconds(st.departure_time)
      LIMIT 3
    ) d
  ) next_arrivals ON true
  ORDER BY c.route_type, c.distance_m;
$$;
GRANT EXECUTE ON FUNCTION public.nearby_transit_stops(numeric, numeric, integer, integer, integer) TO anon, authenticated, service_role;

-- Rollback (restores the previous behaviour exactly):
--   1. Re-run drizzle/migrations/0030_nearby_transit_stops.sql (old
--      nearby_transit_stops; it does not use stop_modes).
--   2. Re-run drizzle/migrations/0026_swap_gtfs_staging_truncate_live.sql, then
--      0027_swap_gtfs_staging_statement_timeout.sql and the first two lines of
--      0048 (old swap without stop_modes, 900 s timeout, service_role only).
--   3. Only after both: DROP TABLE IF EXISTS public.stop_modes;

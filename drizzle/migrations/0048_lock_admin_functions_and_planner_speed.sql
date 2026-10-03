-- 1. Admin-only functions. Postgres lets PUBLIC execute every new function by
--    default, so revoking only from anon/authenticated left these callable by
--    anyone. swap_gtfs_staging() replaces the live timetable.
REVOKE ALL ON FUNCTION public.swap_gtfs_staging() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.swap_gtfs_staging() TO service_role;
REVOKE ALL ON FUNCTION public.prune_import_log() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_import_log() TO service_role;

-- 2. nearby_stops: compare the numeric columns against numeric bounds so the
--    bounding-box prefilter can use stops_lat_lon_idx. Casting the columns to
--    double precision forced a full scan of stops on every call, and the
--    general transit planner calls this ~1,000 times per plan.
CREATE OR REPLACE FUNCTION public.nearby_stops(p_lat numeric, p_lon numeric, p_radius_m integer)
RETURNS TABLE(stop_id text, stop_name text, stop_lat numeric, stop_lon numeric, distance_m double precision)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH b AS (
    SELECT (p_radius_m / 111000.0)::numeric AS dlat,
           (p_radius_m / (111000.0 * greatest(cos(radians(p_lat::double precision)), 0.2)))::numeric AS dlon
  )
  SELECT s.stop_id, s.stop_name, s.stop_lat, s.stop_lon,
         gtfs_distance_m(p_lat, p_lon, s.stop_lat, s.stop_lon) AS distance_m
  FROM stops s, b
  WHERE s.stop_lat BETWEEN p_lat - b.dlat AND p_lat + b.dlat
    AND s.stop_lon BETWEEN p_lon - b.dlon AND p_lon + b.dlon
    AND gtfs_distance_m(p_lat, p_lon, s.stop_lat, s.stop_lon) <= p_radius_m
  ORDER BY distance_m;
$$;
GRANT EXECUTE ON FUNCTION public.nearby_stops(numeric, numeric, integer) TO anon, authenticated, service_role;

-- 3. Planners filter every trip by today's active service ids.
CREATE INDEX IF NOT EXISTS trips_service_route_idx ON public.trips (service_id, route_id);

-- 4. Account deletion cascades through push_subscriptions.user_id.
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON public.push_subscriptions (user_id);

-- 5. Account-owned cascades from 0038 were added NOT VALID. Validate them so
--    every existing row is guaranteed to belong to a real account. Any orphan
--    rows must be removed (after a backup) before this runs on a live database.
ALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_auth_user_fk;
ALTER TABLE public.user_preferences VALIDATE CONSTRAINT user_preferences_auth_user_fk;

-- 6. Nightly retention (debug logs 48h, push deliveries 7d, stale push
--    subscriptions 90d, realtime cache 1d). 03:17 Hawaiʻi time = 13:17 UTC.
--    cron.schedule with a job name replaces an existing job of that name.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('nalu-maintenance', '17 13 * * *', 'SELECT public.nalu_maintenance()');
  END IF;
END $$;

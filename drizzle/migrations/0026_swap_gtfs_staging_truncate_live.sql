-- pg_safeupdate blocks unqualified DELETE for API roles; TRUNCATE is both
-- allowed and transactional, so the swap stays atomic.
CREATE OR REPLACE FUNCTION public.swap_gtfs_staging()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  TRUNCATE stop_times, trips, calendar_dates, calendar, routes, stops;

  INSERT INTO stops SELECT * FROM staging_stops;
  INSERT INTO routes SELECT * FROM staging_routes;
  INSERT INTO calendar SELECT * FROM staging_calendar;
  INSERT INTO calendar_dates SELECT * FROM staging_calendar_dates;
  INSERT INTO trips SELECT * FROM staging_trips;
  INSERT INTO stop_times SELECT * FROM staging_stop_times;

  SELECT jsonb_build_object(
    'stops', (SELECT count(*) FROM stops),
    'routes', (SELECT count(*) FROM routes),
    'trips', (SELECT count(*) FROM trips),
    'calendar', (SELECT count(*) FROM calendar),
    'calendar_dates', (SELECT count(*) FROM calendar_dates),
    'stop_times', (SELECT count(*) FROM stop_times)
  ) INTO result;

  TRUNCATE staging_stop_times, staging_trips, staging_calendar_dates,
           staging_calendar, staging_routes, staging_stops;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.swap_gtfs_staging() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.swap_gtfs_staging() TO service_role;
-- Staging mirrors: the weekly import writes here, never straight into live tables.
CREATE TABLE IF NOT EXISTS public.staging_stops (
  stop_id text PRIMARY KEY,
  stop_name text,
  stop_lat numeric,
  stop_lon numeric,
  location_type integer
);

CREATE TABLE IF NOT EXISTS public.staging_routes (
  route_id text PRIMARY KEY,
  route_short_name text,
  route_long_name text,
  route_type integer
);

CREATE TABLE IF NOT EXISTS public.staging_trips (
  trip_id text PRIMARY KEY,
  route_id text,
  service_id text,
  trip_headsign text,
  direction_id integer
);

CREATE TABLE IF NOT EXISTS public.staging_stop_times (
  trip_id text NOT NULL,
  stop_id text NOT NULL,
  arrival_time text,
  departure_time text,
  stop_sequence integer NOT NULL,
  PRIMARY KEY (trip_id, stop_sequence)
);

CREATE TABLE IF NOT EXISTS public.staging_calendar (
  service_id text PRIMARY KEY,
  monday integer, tuesday integer, wednesday integer, thursday integer,
  friday integer, saturday integer, sunday integer,
  start_date text, end_date text
);

CREATE TABLE IF NOT EXISTS public.staging_calendar_dates (
  service_id text NOT NULL,
  date text NOT NULL,
  exception_type integer,
  PRIMARY KEY (service_id, date)
);

-- Progress of the running import, one row per table being loaded.
CREATE TABLE IF NOT EXISTS public.job_status (
  job_id text NOT NULL,
  table_name text NOT NULL,
  rows_completed integer NOT NULL DEFAULT 0,
  total_rows_estimated integer,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_updated_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'running',
  PRIMARY KEY (job_id, table_name)
);

CREATE INDEX IF NOT EXISTS job_status_last_updated_idx ON public.job_status (last_updated_at DESC);

-- Audit trail; pruned to the newest 10 entries after every run.
CREATE TABLE IF NOT EXISTS public.import_log (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  success boolean NOT NULL,
  row_counts jsonb,
  duration_seconds numeric,
  error_message text
);

-- Staging and bookkeeping are server-only: no anon or authenticated access.
GRANT ALL ON public.staging_stops, public.staging_routes, public.staging_trips,
  public.staging_stop_times, public.staging_calendar, public.staging_calendar_dates,
  public.job_status, public.import_log TO service_role;
GRANT ALL ON SEQUENCE public.import_log_id_seq TO service_role;

ALTER TABLE public.staging_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staging_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staging_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staging_stop_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staging_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staging_calendar_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_log ENABLE ROW LEVEL SECURITY;

-- One transaction: readers either see the whole old feed or the whole new one.
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

  -- All of this runs inside the single implicit transaction of the call.
  DELETE FROM stop_times;
  DELETE FROM trips;
  DELETE FROM calendar_dates;
  DELETE FROM calendar;
  DELETE FROM routes;
  DELETE FROM stops;

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

-- The expiry date always comes from the loaded feed, never a constant.
CREATE OR REPLACE FUNCTION public.gtfs_data_expiry()
RETURNS TABLE(expires_on date, days_remaining integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH latest AS (
    SELECT max(to_date(end_date, 'YYYYMMDD')) AS expires_on FROM calendar
    WHERE end_date IS NOT NULL AND end_date <> ''
  )
  SELECT l.expires_on,
         (l.expires_on - (now() AT TIME ZONE 'Pacific/Honolulu')::date)::integer
  FROM latest l
  WHERE l.expires_on IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.gtfs_data_expiry() TO anon, authenticated, service_role;

-- Keep only the newest 10 log entries.
CREATE OR REPLACE FUNCTION public.prune_import_log()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  DELETE FROM import_log
  WHERE id NOT IN (SELECT id FROM import_log ORDER BY created_at DESC, id DESC LIMIT 10);
$$;

REVOKE ALL ON FUNCTION public.prune_import_log() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_import_log() TO service_role;
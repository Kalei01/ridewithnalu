-- Commute emails: off until the rider turns them on. Only the server
-- (service_role) reads or writes this; riders go through server functions.
CREATE TABLE IF NOT EXISTS public.email_prefs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  opted_in boolean NOT NULL DEFAULT false,
  unsub_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  opted_in_at timestamptz,
  opted_out_at timestamptz,
  welcome_sent_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.email_prefs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_prefs FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.email_prefs TO service_role;

-- Read one rider's choice (false when they never chose).
CREATE OR REPLACE FUNCTION public.email_prefs_get(p_user uuid)
RETURNS TABLE (opted_in boolean, unsub_token uuid, welcome_sent_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT e.opted_in, e.unsub_token, e.welcome_sent_at
  FROM public.email_prefs e
  WHERE e.user_id = p_user;
$$;

-- Turn emails on or off for one rider; returns the row as it now stands.
CREATE OR REPLACE FUNCTION public.email_prefs_set(p_user uuid, p_on boolean)
RETURNS TABLE (opted_in boolean, unsub_token uuid, welcome_sent_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  INSERT INTO public.email_prefs AS e (user_id, opted_in, opted_in_at, opted_out_at)
  VALUES (p_user, p_on, CASE WHEN p_on THEN now() END, CASE WHEN NOT p_on THEN now() END)
  ON CONFLICT (user_id) DO UPDATE SET
    opted_in = p_on,
    opted_in_at = CASE WHEN p_on THEN now() ELSE e.opted_in_at END,
    opted_out_at = CASE WHEN NOT p_on THEN now() ELSE e.opted_out_at END,
    updated_at = now()
  RETURNING e.opted_in, e.unsub_token, e.welcome_sent_at;
$$;

-- The welcome email goes out once per rider, ever.
CREATE OR REPLACE FUNCTION public.email_mark_welcome(p_user uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.email_prefs
  SET welcome_sent_at = now(), updated_at = now()
  WHERE user_id = p_user AND welcome_sent_at IS NULL
  RETURNING true;
$$;

-- Unsubscribe link in every email. The token is the proof; no sign-in needed.
CREATE OR REPLACE FUNCTION public.email_unsubscribe(p_token uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.email_prefs
  SET opted_in = false, opted_out_at = now(), updated_at = now()
  WHERE unsub_token = p_token
  RETURNING true;
$$;

REVOKE ALL ON FUNCTION public.email_prefs_get(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_prefs_set(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_mark_welcome(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_unsubscribe(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_prefs_get(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_prefs_set(uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_mark_welcome(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_unsubscribe(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- "Your week with Nalu" email. The phone sends only weekly totals (no places,
-- no GPS), and only for riders who turned emails on.
ALTER TABLE public.email_prefs ADD COLUMN IF NOT EXISTS weekly_sent_week date;

CREATE TABLE IF NOT EXISTS public.weekly_stats (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  trips integer NOT NULL CHECK (trips BETWEEN 0 AND 500),
  drive_trips integer NOT NULL CHECK (drive_trips BETWEEN 0 AND 500),
  transit_trips integer NOT NULL CHECK (transit_trips BETWEEN 0 AND 500),
  minutes_saved integer NOT NULL CHECK (minutes_saved BETWEEN 0 AND 10000),
  average_minutes integer NOT NULL CHECK (average_minutes BETWEEN 0 AND 1440),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, week_start)
);
ALTER TABLE public.weekly_stats ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.weekly_stats FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.weekly_stats TO service_role;

-- Save this week's totals, but only for riders who turned emails on.
CREATE OR REPLACE FUNCTION public.weekly_stats_save(
  p_user uuid, p_week date, p_trips integer, p_drive integer, p_transit integer,
  p_saved integer, p_average integer
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  INSERT INTO public.weekly_stats AS w
    (user_id, week_start, trips, drive_trips, transit_trips, minutes_saved, average_minutes)
  SELECT p_user, p_week, p_trips, p_drive, p_transit, p_saved, p_average
  WHERE EXISTS (SELECT 1 FROM public.email_prefs e WHERE e.user_id = p_user AND e.opted_in)
  ON CONFLICT (user_id, week_start) DO UPDATE SET
    trips = EXCLUDED.trips,
    drive_trips = EXCLUDED.drive_trips,
    transit_trips = EXCLUDED.transit_trips,
    minutes_saved = EXCLUDED.minutes_saved,
    average_minutes = EXCLUDED.average_minutes,
    updated_at = now()
  RETURNING true;
$$;

-- Who gets this week's email: opted in, at least one trip, not sent yet.
CREATE OR REPLACE FUNCTION public.weekly_email_recipients(p_week date, p_limit integer)
RETURNS TABLE (
  user_id uuid, email text, unsub_token uuid, trips integer, drive_trips integer,
  transit_trips integer, minutes_saved integer, average_minutes integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT w.user_id, u.email::text, e.unsub_token, w.trips, w.drive_trips,
         w.transit_trips, w.minutes_saved, w.average_minutes
  FROM public.weekly_stats w
  JOIN public.email_prefs e ON e.user_id = w.user_id AND e.opted_in
  JOIN auth.users u ON u.id = w.user_id AND u.email IS NOT NULL
  WHERE w.week_start = p_week
    AND w.trips > 0
    AND (e.weekly_sent_week IS NULL OR e.weekly_sent_week < p_week)
  ORDER BY w.user_id
  LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION public.email_mark_weekly(p_user uuid, p_week date)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.email_prefs SET weekly_sent_week = p_week, updated_at = now() WHERE user_id = p_user;
$$;

REVOKE ALL ON FUNCTION public.weekly_stats_save(uuid, date, integer, integer, integer, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.weekly_email_recipients(date, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_mark_weekly(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.weekly_stats_save(uuid, date, integer, integer, integer, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.weekly_email_recipients(date, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_mark_weekly(uuid, date) TO service_role;

-- Weekly totals older than 8 weeks aren't needed.
CREATE OR REPLACE FUNCTION public.weekly_stats_cleanup()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  DELETE FROM public.weekly_stats WHERE week_start < current_date - 56;
$$;
REVOKE ALL ON FUNCTION public.weekly_stats_cleanup() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.weekly_stats_cleanup() TO service_role;

-- Sunday 6 p.m. Honolulu (Monday 04:00 UTC): send the weekly email. The
-- server refuses to send until a mailing address is set in the email footer.
DO $$
BEGIN
  PERFORM cron.unschedule('nalu-weekly-email') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nalu-weekly-email');
  PERFORM cron.schedule(
    'nalu-weekly-email',
    '0 4 * * 1',
    $call$
    SELECT public.weekly_stats_cleanup();
    SELECT net.http_post(
      url := 'https://ridenalu.com/api/public/weekly-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'nalu_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    );
    $call$
  );
END $$;

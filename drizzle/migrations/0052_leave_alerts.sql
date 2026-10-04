-- "Time to leave" alerts.
--
-- A rider who turns the alert on stores just enough to plan the trip: the two
-- ends rounded to about a block (3 decimals), the arrival time and the days.
-- Rows belong to a push subscription (holding the device token is the proof,
-- as for push_subscriptions) and disappear with it. Only the server reads them.
CREATE TABLE IF NOT EXISTS public.leave_alerts (
  token text NOT NULL REFERENCES public.push_subscriptions(token) ON DELETE CASCADE,
  place_key text NOT NULL,
  place_label text NOT NULL CHECK (length(place_label) BETWEEN 1 AND 60),
  to_home boolean NOT NULL DEFAULT false,
  origin_lat numeric(7,3) NOT NULL CHECK (origin_lat BETWEEN 21 AND 22),
  origin_lon numeric(8,3) NOT NULL CHECK (origin_lon BETWEEN -158.4 AND -157.5),
  dest_lat numeric(7,3) NOT NULL CHECK (dest_lat BETWEEN 21 AND 22),
  dest_lon numeric(8,3) NOT NULL CHECK (dest_lon BETWEEN -158.4 AND -157.5),
  arrive_min integer NOT NULL CHECK (arrive_min BETWEEN 0 AND 1439),
  days smallint[] NOT NULL CHECK (days <@ ARRAY[1,2,3,4,5,6,7]::smallint[] AND cardinality(days) > 0),
  last_sent_on date,
  next_check_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (token, place_key)
);

ALTER TABLE public.leave_alerts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.leave_alerts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_alerts TO service_role;

-- Every 5 minutes: the app checks alerts whose leave time is getting close.
-- Same Vault secret as the other scheduled jobs; it never appears in cron.job.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not installed; skipping leave alert schedule';
    RETURN;
  END IF;
  PERFORM cron.schedule(
    'nalu-leave-alerts',
    '*/5 * * * *',
    $call$
    SELECT net.http_post(
      url := 'https://ridewithnalu.jreverio01.workers.dev/api/public/leave-alerts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'nalu_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
    $call$
  );
END $$;

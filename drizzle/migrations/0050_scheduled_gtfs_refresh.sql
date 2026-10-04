-- Weekly TheBus GTFS refresh, scheduled from the database.
-- pg_cron calls the app's /api/public/import-gtfs route through pg_net. The
-- Bearer credential is read from Supabase Vault at run time (secret name
-- nalu_cron_secret, the same value as the Worker's LOVABLE_CRON_SECRET), so it
-- never appears in cron.job. Re-running this file replaces the jobs by name.
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE
  site text := 'https://ridewithnalu.jreverio01.workers.dev/api/public/import-gtfs';
  call_sql text := $call$
    SELECT net.http_post(
      url := %L,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'nalu_cron_secret')
      ),
      body := %L::jsonb,
      timeout_milliseconds := 300000
    );
  $call$;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not installed; skipping GTFS refresh schedule';
    RETURN;
  END IF;
  -- Sundays 02:00 Hawaiʻi time (12:00 UTC): start a fresh import.
  PERFORM cron.schedule('nalu-gtfs-weekly', '0 12 * * 0', format(call_sql, site, '{}'));
  -- Hourly at :15: finish an import that stopped partway (no-op otherwise).
  PERFORM cron.schedule('nalu-gtfs-resume', '15 * * * *', format(call_sql, site, '{"mode":"resume"}'));
END $$;

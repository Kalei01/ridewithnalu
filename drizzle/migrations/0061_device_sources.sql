-- Where users come from: the first ?ref= tag (or utm_source) a phone arrived
-- with, e.g. ridenalu.com/?ref=west. Anonymous random phone id plus a short
-- channel name only; no names, accounts or locations.

CREATE TABLE IF NOT EXISTS public.device_sources (
  device_id text PRIMARY KEY CHECK (device_id ~ '^[A-Za-z0-9-]{8,64}$'),
  ref text NOT NULL CHECK (ref ~ '^[a-z0-9_-]{1,32}$'),
  first_seen date NOT NULL DEFAULT (now() AT TIME ZONE 'Pacific/Honolulu')::date
);
ALTER TABLE public.device_sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.device_sources FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.device_sources TO service_role;

-- First channel wins; later visits with other tags don't overwrite it.
CREATE OR REPLACE FUNCTION public.record_device_source(p_device text, p_ref text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  INSERT INTO public.device_sources (device_id, ref) VALUES (p_device, p_ref)
  ON CONFLICT (device_id) DO NOTHING;
$$;
REVOKE ALL ON FUNCTION public.record_device_source(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_device_source(text, text) TO service_role;

-- Weekly users, now also split by channel (phones with no tag count as "direct").
CREATE OR REPLACE FUNCTION public.usage_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH today AS (SELECT (now() AT TIME ZONE 'Pacific/Honolulu')::date AS d)
  SELECT jsonb_build_object(
    'weekly_users', (SELECT count(DISTINCT device_id) FROM app_opens, today WHERE day > today.d - 7),
    'previous_week_users', (SELECT count(DISTINCT device_id) FROM app_opens, today WHERE day <= today.d - 7 AND day > today.d - 14),
    'today_users', (SELECT count(DISTINCT device_id) FROM app_opens, today WHERE day = today.d),
    'weekly_signed_in', (SELECT count(DISTINCT device_id) FROM app_opens, today WHERE day > today.d - 7 AND tier <> 'guest'),
    'accounts', (SELECT count(*) FROM auth.users),
    'new_accounts_week', (SELECT count(*) FROM auth.users WHERE created_at > now() - interval '7 days'),
    'paying', (SELECT count(*) FROM subscriptions WHERE status IN ('active', 'trialing')),
    'weekly_by_ref', (
      SELECT coalesce(jsonb_object_agg(ref, n), '{}'::jsonb)
      FROM (
        SELECT coalesce(s.ref, 'direct') AS ref, count(DISTINCT o.device_id) AS n
        FROM app_opens o
        CROSS JOIN today
        LEFT JOIN device_sources s ON s.device_id = o.device_id
        WHERE o.day > today.d - 7
        GROUP BY 1
      ) t
    )
  );
$$;
REVOKE ALL ON FUNCTION public.usage_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.usage_stats() TO service_role;

-- Nightly cleanup, now also dropping channels of phones no longer counted.
CREATE OR REPLACE FUNCTION public.nalu_maintenance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE d1 int; d2 int; d3 int; d4 int; d5 int; d6 int;
BEGIN
  DELETE FROM public.debug_logs WHERE created_at < now() - interval '48 hours';
  GET DIAGNOSTICS d1 = ROW_COUNT;
  DELETE FROM public.push_deliveries WHERE sent_at < now() - interval '7 days';
  GET DIAGNOSTICS d2 = ROW_COUNT;
  DELETE FROM public.push_subscriptions WHERE updated_at < now() - interval '90 days';
  GET DIAGNOSTICS d3 = ROW_COUNT;
  DELETE FROM public.trip_updates WHERE fetched_at < now() - interval '1 day';
  DELETE FROM public.app_problems WHERE last_seen < now() - interval '30 days';
  GET DIAGNOSTICS d4 = ROW_COUNT;
  DELETE FROM public.app_opens WHERE day < (now() AT TIME ZONE 'Pacific/Honolulu')::date - 120;
  GET DIAGNOSTICS d5 = ROW_COUNT;
  -- A phone's first channel is only kept while that phone is still counted.
  DELETE FROM public.device_sources s
  WHERE NOT EXISTS (SELECT 1 FROM public.app_opens o WHERE o.device_id = s.device_id);
  GET DIAGNOSTICS d6 = ROW_COUNT;
  RETURN jsonb_build_object('debug_logs', d1, 'push_deliveries', d2, 'push_subscriptions', d3,
                            'app_problems', d4, 'app_opens', d5, 'device_sources', d6);
END $$;

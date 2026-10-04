-- Private usage counts for the Dev panel: one row per phone per day it opened
-- Nalu (an anonymous random id, no names or locations). Tells the owners when
-- the ~200 weekly users that Phase 2 of the plans waits for has been reached.

CREATE TABLE IF NOT EXISTS public.app_opens (
  device_id text NOT NULL CHECK (device_id ~ '^[A-Za-z0-9-]{8,64}$'),
  day date NOT NULL,
  tier text NOT NULL CHECK (tier IN ('guest', 'free', 'plus')),
  PRIMARY KEY (device_id, day)
);
ALTER TABLE public.app_opens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_opens FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_opens TO service_role;

CREATE OR REPLACE FUNCTION public.record_app_open(p_device text, p_tier text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  INSERT INTO public.app_opens (device_id, day, tier)
  VALUES (p_device, (now() AT TIME ZONE 'Pacific/Honolulu')::date, p_tier)
  ON CONFLICT (device_id, day) DO UPDATE SET tier = EXCLUDED.tier;
$$;
REVOKE ALL ON FUNCTION public.record_app_open(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_app_open(text, text) TO service_role;

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
    'paying', (SELECT count(*) FROM subscriptions WHERE status IN ('active', 'trialing'))
  );
$$;
REVOKE ALL ON FUNCTION public.usage_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.usage_stats() TO service_role;

-- Nightly cleanup keeps about four months of counts.
CREATE OR REPLACE FUNCTION public.nalu_maintenance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE d1 int; d2 int; d3 int; d4 int; d5 int;
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
  RETURN jsonb_build_object('debug_logs', d1, 'push_deliveries', d2, 'push_subscriptions', d3,
                            'app_problems', d4, 'app_opens', d5);
END $$;

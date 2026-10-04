-- Problems list: app and server errors in one small table, one row per kind
-- of problem (a fingerprint), with a count. Developers see it in the Dev
-- panel and get one notification per problem per day (at most 10 a day).

CREATE TABLE IF NOT EXISTS public.app_problems (
  fingerprint text PRIMARY KEY,
  source text NOT NULL CHECK (source IN ('app', 'server')),
  area text NOT NULL,
  message text NOT NULL,
  count integer NOT NULL DEFAULT 1,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  notified_on date
);
ALTER TABLE public.app_problems ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_problems FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_problems TO service_role;

-- Records one occurrence. Returns true when developers should be notified now.
CREATE OR REPLACE FUNCTION public.record_app_problem(
  p_fingerprint text,
  p_source text,
  p_area text,
  p_message text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  today date := (now() AT TIME ZONE 'Pacific/Honolulu')::date;
  notified_today integer;
  should boolean := false;
BEGIN
  INSERT INTO public.app_problems (fingerprint, source, area, message)
  VALUES (left(p_fingerprint, 200), p_source, left(p_area, 60), left(p_message, 300))
  ON CONFLICT (fingerprint) DO UPDATE
    SET count = public.app_problems.count + 1,
        last_seen = now(),
        message = EXCLUDED.message;

  -- Keep the table small even if something floods it.
  DELETE FROM public.app_problems
  WHERE fingerprint IN (
    SELECT fingerprint FROM public.app_problems ORDER BY last_seen DESC OFFSET 300
  );

  SELECT count(*) INTO notified_today FROM public.app_problems WHERE notified_on = today;
  IF notified_today < 10 THEN
    UPDATE public.app_problems
    SET notified_on = today
    WHERE fingerprint = left(p_fingerprint, 200) AND notified_on IS DISTINCT FROM today
    RETURNING true INTO should;
  END IF;
  RETURN coalesce(should, false);
END $$;
REVOKE ALL ON FUNCTION public.record_app_problem(text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_app_problem(text, text, text, text) TO service_role;

-- Nightly cleanup also drops problems not seen for 30 days.
CREATE OR REPLACE FUNCTION public.nalu_maintenance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE d1 int; d2 int; d3 int; d4 int;
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
  RETURN jsonb_build_object('debug_logs', d1, 'push_deliveries', d2, 'push_subscriptions', d3, 'app_problems', d4);
END $$;

-- Notification tokens for developer phones (linked from the Dev panel).
CREATE OR REPLACE FUNCTION public.developer_push_tokens()
RETURNS TABLE (token text, categories text[], quiet_start_min integer, quiet_end_min integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT s.token, s.categories, s.quiet_start_min, s.quiet_end_min
  FROM public.push_subscriptions s
  JOIN auth.users u ON u.id = s.user_id
  JOIN public.comped_accounts c ON c.email = lower(u.email)
  WHERE c.is_developer AND u.email_confirmed_at IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.developer_push_tokens() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.developer_push_tokens() TO service_role;

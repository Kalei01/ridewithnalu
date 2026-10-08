-- Visitor funnel (proposal P-1): anonymous step counters. One row per day,
-- step and link tag with a running count. No phone id, account, location or
-- text is stored, so a row cannot be traced to a person. "Came back within 7
-- days" is worked out from the existing app_opens table, not stored here.

CREATE TABLE IF NOT EXISTS public.funnel_counts (
  day date NOT NULL,
  step text NOT NULL CHECK (step IN (
    'landed_intro', 'landed_guide', 'landed_app',
    'trip_tried', 'answer_shown',
    'answer_under_5s', 'answer_5_to_10s', 'answer_over_10s',
    'maps_opened', 'installed'
  )),
  ref text NOT NULL DEFAULT '' CHECK (ref ~ '^([a-z0-9_-]{1,32})?$'),
  n integer NOT NULL DEFAULT 0 CHECK (n >= 0),
  PRIMARY KEY (day, step, ref)
);
ALTER TABLE public.funnel_counts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.funnel_counts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.funnel_counts TO service_role;

CREATE OR REPLACE FUNCTION public.record_funnel_step(p_step text, p_ref text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  INSERT INTO public.funnel_counts (day, step, ref, n)
  VALUES ((now() AT TIME ZONE 'Pacific/Honolulu')::date, p_step, coalesce(p_ref, ''), 1)
  ON CONFLICT (day, step, ref) DO UPDATE SET n = public.funnel_counts.n + 1;
$$;
REVOKE ALL ON FUNCTION public.record_funnel_step(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_funnel_step(text, text) TO service_role;

-- Last 7 days of steps (total and by link tag), plus how many phones that first
-- opened Nalu 8 to 14 days ago opened it again within 7 days of the first time.
CREATE OR REPLACE FUNCTION public.funnel_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH today AS (SELECT (now() AT TIME ZONE 'Pacific/Honolulu')::date AS d),
  firsts AS (SELECT device_id, min(day) AS first_day FROM app_opens GROUP BY device_id),
  cohort AS (SELECT f.device_id, f.first_day FROM firsts f, today WHERE f.first_day <= today.d - 8 AND f.first_day > today.d - 15)
  SELECT jsonb_build_object(
    'steps_week', (
      SELECT coalesce(jsonb_object_agg(step, total), '{}'::jsonb)
      FROM (SELECT step, sum(n) AS total FROM funnel_counts, today WHERE day > today.d - 7 GROUP BY step) s
    ),
    'steps_week_by_ref', (
      SELECT coalesce(jsonb_object_agg(k, total), '{}'::jsonb)
      FROM (SELECT (CASE WHEN ref = '' THEN 'direct' ELSE ref END) || ':' || step AS k, sum(n) AS total
            FROM funnel_counts, today WHERE day > today.d - 7 GROUP BY 1) s
    ),
    'new_phones_cohort', (SELECT count(*) FROM cohort),
    'came_back_within_7_days', (
      SELECT count(*) FROM cohort c
      WHERE EXISTS (SELECT 1 FROM app_opens o WHERE o.device_id = c.device_id AND o.day > c.first_day AND o.day <= c.first_day + 7)
    ),
    'new_accounts_week', (SELECT count(*) FROM auth.users WHERE created_at > now() - interval '7 days')
  );
$$;
REVOKE ALL ON FUNCTION public.funnel_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.funnel_stats() TO service_role;

-- Nightly cleanup: keep about four months of step counts, like app_opens.
CREATE OR REPLACE FUNCTION public.nalu_maintenance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE d1 int; d2 int; d3 int; d4 int; d5 int; d6 int; d7 int;
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
  DELETE FROM public.device_sources s
  WHERE NOT EXISTS (SELECT 1 FROM public.app_opens o WHERE o.device_id = s.device_id);
  GET DIAGNOSTICS d6 = ROW_COUNT;
  DELETE FROM public.funnel_counts WHERE day < (now() AT TIME ZONE 'Pacific/Honolulu')::date - 120;
  GET DIAGNOSTICS d7 = ROW_COUNT;
  RETURN jsonb_build_object('debug_logs', d1, 'push_deliveries', d2, 'push_subscriptions', d3,
                            'app_problems', d4, 'app_opens', d5, 'device_sources', d6, 'funnel_counts', d7);
END $$;

-- Rollback: DROP FUNCTION IF EXISTS public.funnel_stats(); DROP FUNCTION IF EXISTS public.record_funnel_step(text, text); DROP TABLE IF EXISTS public.funnel_counts;

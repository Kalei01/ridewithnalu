CREATE TABLE IF NOT EXISTS public.debug_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  session_id text NOT NULL,
  reason text NOT NULL DEFAULT 'interval',
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.debug_logs TO service_role;
ALTER TABLE public.debug_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS debug_logs_device_idx ON public.debug_logs (device_id);
CREATE INDEX IF NOT EXISTS debug_logs_created_idx ON public.debug_logs (created_at);

CREATE OR REPLACE FUNCTION public.nalu_maintenance()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d1 int; d2 int; d3 int;
BEGIN
  DELETE FROM public.debug_logs WHERE created_at < now() - interval '48 hours';
  GET DIAGNOSTICS d1 = ROW_COUNT;
  DELETE FROM public.push_deliveries WHERE sent_at < now() - interval '7 days';
  GET DIAGNOSTICS d2 = ROW_COUNT;
  DELETE FROM public.push_subscriptions WHERE updated_at < now() - interval '90 days';
  GET DIAGNOSTICS d3 = ROW_COUNT;
  DELETE FROM public.trip_updates WHERE fetched_at < now() - interval '1 day';
  RETURN jsonb_build_object('debug_logs', d1, 'push_deliveries', d2, 'push_subscriptions', d3);
END $$;
REVOKE ALL ON FUNCTION public.nalu_maintenance() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nalu_maintenance() TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron;
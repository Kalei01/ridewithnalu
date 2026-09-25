CREATE TABLE public.push_subscriptions (
  token text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  categories text[] NOT NULL DEFAULT '{}',
  quiet_start_min integer CHECK (quiet_start_min BETWEEN 0 AND 1439),
  quiet_end_min integer CHECK (quiet_end_min BETWEEN 0 AND 1439),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.push_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL REFERENCES public.push_subscriptions(token) ON DELETE CASCADE,
  dedupe_key text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (token, dedupe_key)
);
GRANT ALL ON public.push_deliveries TO service_role;
ALTER TABLE public.push_deliveries ENABLE ROW LEVEL SECURITY;
CREATE INDEX push_deliveries_sent_at_idx ON public.push_deliveries (sent_at);
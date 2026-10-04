-- Plans groundwork: guest (not signed in), free (signed up), plus (paid).
-- Nothing is restricted yet; the app asks my_tier() and decides later.

-- Accounts that always get the top tier (the owners' own accounts).
CREATE TABLE IF NOT EXISTS public.comped_accounts (
  email text PRIMARY KEY CHECK (email = lower(email)),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.comped_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.comped_accounts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comped_accounts TO service_role;

INSERT INTO public.comped_accounts (email, note) VALUES
  ('jreverio01@gmail.com', 'owner'),
  ('hellonalu14@gmail.com', 'owner'),
  ('bessieyabut@gmail.com', 'owner family')
ON CONFLICT (email) DO NOTHING;

-- Paid subscriptions, written only by the server (a payment webhook later).
CREATE TABLE IF NOT EXISTS public.subscriptions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'plus' CHECK (plan IN ('plus')),
  status text NOT NULL CHECK (status IN ('active', 'trialing', 'past_due', 'canceled')),
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.subscriptions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO service_role;
DROP POLICY IF EXISTS "own subscription" ON public.subscriptions;
CREATE POLICY "own subscription" ON public.subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
GRANT SELECT ON public.subscriptions TO authenticated;

-- The caller's plan. Comped accounts count only with a confirmed email, so
-- nobody can claim one by signing up with that address.
CREATE OR REPLACE FUNCTION public.my_tier()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN 'guest'
    WHEN EXISTS (
      SELECT 1
      FROM auth.users u
      JOIN public.comped_accounts c ON c.email = lower(u.email)
      WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL
    ) THEN 'plus'
    WHEN EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.user_id = auth.uid()
        AND s.status IN ('active', 'trialing')
        AND (s.current_period_end IS NULL OR s.current_period_end > now())
    ) THEN 'plus'
    ELSE 'free'
  END;
$$;
REVOKE ALL ON FUNCTION public.my_tier() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_tier() TO anon, authenticated, service_role;

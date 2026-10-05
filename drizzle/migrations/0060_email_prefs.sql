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

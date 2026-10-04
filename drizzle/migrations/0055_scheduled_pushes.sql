-- One-time reminders such as "your last bus home leaves in 15 minutes".
-- Sent by the existing 5-minute leave-alerts job; one pending reminder per
-- device and kind, deleted once sent (or when the device's sign-up goes).
CREATE TABLE IF NOT EXISTS public.scheduled_pushes (
  token text NOT NULL REFERENCES public.push_subscriptions(token) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('last_bus')),
  send_at timestamptz NOT NULL,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 80),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 240),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (token, kind)
);
ALTER TABLE public.scheduled_pushes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.scheduled_pushes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_pushes TO service_role;
CREATE INDEX IF NOT EXISTS scheduled_pushes_send_at_idx ON public.scheduled_pushes (send_at);

-- Rider feedback (proposal P-4): "Tell Nalu something". Plain text only, no
-- account, device id or contact details. Written only by the server through
-- submit_rider_feedback(); read only with the service role (weekly review).
-- Additive: one new table and one new function; touches nothing else.

CREATE TABLE IF NOT EXISTS public.rider_feedback (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  category text NOT NULL CHECK (category IN ('wrong_answer', 'idea', 'other')),
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 500),
  trip_note text CHECK (trip_note IS NULL OR char_length(trip_note) <= 200)
);
CREATE INDEX IF NOT EXISTS rider_feedback_created_idx ON public.rider_feedback (created_at DESC);
ALTER TABLE public.rider_feedback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rider_feedback FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.rider_feedback TO service_role;

-- Inserts one note. Returns false (nothing stored) when more than 200 notes
-- arrived in the last 24 hours, so a flood cannot grow the table. Notes older
-- than 180 days are removed here, so no separate cleanup job is needed.
CREATE OR REPLACE FUNCTION public.submit_rider_feedback(p_category text, p_message text, p_trip_note text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(66066);
  DELETE FROM public.rider_feedback WHERE created_at < now() - interval '180 days';
  IF (SELECT count(*) FROM public.rider_feedback WHERE created_at > now() - interval '24 hours') >= 200 THEN
    RETURN false;
  END IF;
  INSERT INTO public.rider_feedback (category, message, trip_note)
  VALUES (p_category, left(p_message, 500), nullif(left(coalesce(p_trip_note, ''), 200), ''));
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.submit_rider_feedback(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_rider_feedback(text, text, text) TO service_role;

-- Rollback: DROP FUNCTION IF EXISTS public.submit_rider_feedback(text, text, text); DROP TABLE IF EXISTS public.rider_feedback;

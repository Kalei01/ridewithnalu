-- Developer mode: owner accounts can preview every tier in the app.
ALTER TABLE public.comped_accounts ADD COLUMN IF NOT EXISTS is_developer boolean NOT NULL DEFAULT false;
UPDATE public.comped_accounts SET is_developer = true
WHERE email IN ('jreverio01@gmail.com', 'hellonalu14@gmail.com');

-- True only for a confirmed developer account.
CREATE OR REPLACE FUNCTION public.am_i_developer()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    JOIN public.comped_accounts c ON c.email = lower(u.email)
    WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL AND c.is_developer
  );
$$;
REVOKE ALL ON FUNCTION public.am_i_developer() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.am_i_developer() TO anon, authenticated, service_role;

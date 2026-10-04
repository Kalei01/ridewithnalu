-- Owner accounts (the comped list) aren't counted in weekly users.
CREATE OR REPLACE FUNCTION public.am_i_owner()
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
    WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL
  );
$$;
REVOKE ALL ON FUNCTION public.am_i_owner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.am_i_owner() TO authenticated, service_role;

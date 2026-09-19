-- The bulk insert of ~1M rows needs more than the API statement timeout.
ALTER FUNCTION public.swap_gtfs_staging() SET statement_timeout TO '900s';
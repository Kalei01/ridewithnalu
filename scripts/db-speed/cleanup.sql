-- Drops the temporary side-by-side functions (keeps stop_modes, which 0063 uses).
DROP FUNCTION IF EXISTS public.nearby_transit_stops_v2(numeric, numeric, integer, integer, integer);
DROP FUNCTION IF EXISTS public.plan_transit_general_v2(numeric, numeric, numeric, numeric, integer, integer, integer, integer, integer, integer);

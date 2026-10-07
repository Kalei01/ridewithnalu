-- Drops the temporary side-by-side function (keeps stop_modes, which 0063 uses).
DROP FUNCTION IF EXISTS public.nearby_transit_stops_v2(numeric, numeric, integer, integer, integer);

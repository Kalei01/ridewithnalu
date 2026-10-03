CREATE TABLE IF NOT EXISTS public.station_parking (
  name_match text PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('available','limited','none')),
  note text
);
GRANT SELECT ON public.station_parking TO anon, authenticated;
GRANT ALL ON public.station_parking TO service_role;
ALTER TABLE public.station_parking ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Parking info is public" ON public.station_parking;
CREATE POLICY "Parking info is public" ON public.station_parking FOR SELECT TO anon, authenticated USING (true);
INSERT INTO public.station_parking (name_match, status, note) VALUES
  ('pearl highlands', 'available', 'Park & Ride garage')
ON CONFLICT (name_match) DO NOTHING;

CREATE OR REPLACE FUNCTION public.feeder_bus_to_station(p_lat numeric, p_lon numeric, p_station text, p_after_seconds integer)
RETURNS TABLE(route_short_name text, board_stop_name text, alight_stop_name text, board_walk_m double precision, depart_seconds integer, ride_minutes integer, arrive_seconds integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH active AS MATERIALIZED (SELECT DISTINCT service_id FROM public.active_service_ids()),
  st AS (SELECT stop_lat, stop_lon FROM public.stops WHERE stop_id = p_station),
  near_user AS MATERIALIZED (
    SELECT s.stop_id, s.stop_name, public.gtfs_distance_m(p_lat, p_lon, s.stop_lat, s.stop_lon) d
    FROM public.stops s
    WHERE s.stop_lat BETWEEN p_lat - 0.006 AND p_lat + 0.006 AND s.stop_lon BETWEEN p_lon - 0.006 AND p_lon + 0.006
  ),
  near_station AS MATERIALIZED (
    SELECT s.stop_id, s.stop_name FROM public.stops s, st
    WHERE s.stop_lat BETWEEN st.stop_lat - 0.004 AND st.stop_lat + 0.004 AND s.stop_lon BETWEEN st.stop_lon - 0.004 AND st.stop_lon + 0.004
      AND public.gtfs_distance_m(st.stop_lat, st.stop_lon, s.stop_lat, s.stop_lon) <= 400
  ),
  rides AS (
    SELECT r.route_short_name, nu.stop_name board, ns.stop_name alight, nu.d,
      public.gtfs_seconds(a.departure_time) dep, public.gtfs_seconds(b.arrival_time) arr
    FROM near_user nu
    JOIN public.stop_times a ON a.stop_id = nu.stop_id
    JOIN public.trips t ON t.trip_id = a.trip_id
    JOIN active ac ON ac.service_id = t.service_id
    JOIN public.routes r ON r.route_id = t.route_id AND r.route_type = 3
    JOIN public.stop_times b ON b.trip_id = a.trip_id AND b.stop_sequence > a.stop_sequence
    JOIN near_station ns ON ns.stop_id = b.stop_id
    WHERE nu.d <= 600
      AND public.gtfs_seconds(a.departure_time) >= p_after_seconds + (nu.d / 80 * 60)::int
      AND public.gtfs_seconds(a.departure_time) <= p_after_seconds + 5400
  ),
  best AS (
    SELECT DISTINCT ON (route_short_name) * FROM rides ORDER BY route_short_name, arr
  )
  SELECT route_short_name, board, alight, d, dep, greatest(1, ((arr - dep) / 60))::int, arr
  FROM best ORDER BY arr LIMIT 3;
$$;
GRANT EXECUTE ON FUNCTION public.feeder_bus_to_station(numeric, numeric, text, integer) TO anon, authenticated;
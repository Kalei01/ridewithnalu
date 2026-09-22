-- Authoritative rail line ordering, taken from the longest rail trip in the feed.
-- Lets the map draw the real Skyline alignment even when a specific trip cannot
-- be matched to an itinerary leg.
CREATE OR REPLACE FUNCTION public.rail_line_stations()
RETURNS TABLE(stop_id text, stop_name text, stop_lat numeric, stop_lon numeric, line_sequence integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH longest AS (
    SELECT st.trip_id, count(*) AS stops
    FROM stop_times st
    JOIN trips t ON t.trip_id = st.trip_id
    JOIN routes r ON r.route_id = t.route_id
    WHERE r.route_type = 1
    GROUP BY st.trip_id
    ORDER BY count(*) DESC, st.trip_id
    LIMIT 1
  )
  SELECT s.stop_id, s.stop_name, s.stop_lat, s.stop_lon,
         row_number() OVER (ORDER BY st.stop_sequence)::int AS line_sequence
  FROM longest l
  JOIN stop_times st ON st.trip_id = l.trip_id
  JOIN stops s ON s.stop_id = st.stop_id
  ORDER BY st.stop_sequence
$$;

GRANT EXECUTE ON FUNCTION public.rail_line_stations() TO anon, authenticated, service_role;
-- directional_dest_stop existed only in Lovable's database (created outside the
-- migrations). Definition copied verbatim from Lovable's export on 2026-10-04 so a
-- database rebuilt from migrations has every function the app calls.
-- Nearest bus stop to a point whose route heads toward (p_toward_rail) or away
-- from a Skyline station, used to pick the correct side of the street.
CREATE OR REPLACE FUNCTION public.directional_dest_stop(
  p_lat numeric,
  p_lon numeric,
  p_toward_rail boolean DEFAULT false,
  p_radius_m integer DEFAULT 805,
  p_station_radius_m numeric DEFAULT 402
)
RETURNS TABLE(
  stop_id text,
  stop_name text,
  stop_lat numeric,
  stop_lon numeric,
  distance_m double precision,
  direction_id integer,
  route_short_name text,
  route_long_name text,
  headsign text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH active AS MATERIALIZED (SELECT DISTINCT a.service_id FROM active_service_ids() a),
  railnear AS MATERIALIZED (
    SELECT DISTINCT s.stop_id
    FROM rail_stations() rs
    JOIN stops s ON s.stop_lat IS NOT NULL AND s.stop_lon IS NOT NULL
                AND gtfs_distance_m(rs.stop_lat, rs.stop_lon, s.stop_lat, s.stop_lon) <= p_station_radius_m
  ),
  candidates AS MATERIALIZED (
    SELECT n.stop_id, n.stop_name, n.stop_lat, n.stop_lon, n.distance_m
    FROM nearby_stops(p_lat, p_lon, p_radius_m) n
    ORDER BY n.distance_m
    LIMIT 40
  )
  SELECT c.stop_id, c.stop_name, c.stop_lat, c.stop_lon, c.distance_m,
         m.direction_id, m.route_short_name, m.route_long_name, m.headsign
  FROM candidates c
  CROSS JOIN LATERAL (
    SELECT t.direction_id, r.route_short_name, r.route_long_name, t.trip_headsign AS headsign
    FROM stop_times sc
    JOIN trips t ON t.trip_id = sc.trip_id AND t.service_id IN (SELECT service_id FROM active)
    JOIN routes r ON r.route_id = t.route_id AND r.route_type = 3
    JOIN stop_times sr ON sr.trip_id = sc.trip_id
                      AND sr.stop_id IN (SELECT stop_id FROM railnear)
                      AND CASE WHEN p_toward_rail
                               THEN sr.stop_sequence > sc.stop_sequence
                               ELSE sr.stop_sequence < sc.stop_sequence END
    WHERE sc.stop_id = c.stop_id
    LIMIT 1
  ) m
  ORDER BY c.distance_m
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.directional_dest_stop(numeric, numeric, boolean, integer, numeric)
  TO anon, authenticated, service_role;

-- Live connecting-bus lookup used once a trip is underway: from the rider's
-- actual coordinates and the current Honolulu time, which stop to walk to and
-- the next buses from it that reach the destination stop.
CREATE OR REPLACE FUNCTION public.connecting_departures(
  p_lat numeric,
  p_lon numeric,
  p_dest_stop text,
  p_after_seconds integer DEFAULT 0,
  p_radius_m integer DEFAULT 1207,
  p_limit integer DEFAULT 4
)
RETURNS TABLE(
  stop_id text,
  stop_name text,
  distance_m numeric,
  walk_minutes integer,
  route_id text,
  route_short_name text,
  route_long_name text,
  headsign text,
  depart_seconds integer,
  arrive_seconds integer,
  ride_minutes integer,
  dest_stop_name text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH active AS MATERIALIZED (SELECT DISTINCT a.service_id FROM active_service_ids() a),
  near AS MATERIALIZED (
    SELECT n.stop_id, n.stop_name, n.distance_m,
           ceil(n.distance_m / 80.47)::integer AS walk_min
    FROM nearby_stops(p_lat, p_lon, p_radius_m) n
  ),
  dest_routes AS MATERIALIZED (
    SELECT DISTINCT t.route_id
    FROM stop_times d
    JOIN trips t ON t.trip_id = d.trip_id
    JOIN routes r ON r.route_id = t.route_id AND r.route_type <> 1
    WHERE d.stop_id = p_dest_stop
      AND t.service_id IN (SELECT service_id FROM active)
  ),
  rides AS (
    SELECT n.stop_id, n.stop_name, n.distance_m, n.walk_min,
           r.route_id, r.route_short_name, r.route_long_name, tp.trip_headsign,
           gtfs_seconds(b.departure_time) AS depart_sec,
           gtfs_seconds(d.arrival_time) AS arrive_sec
    FROM near n
    JOIN stop_times b ON b.stop_id = n.stop_id
    JOIN trips tp ON tp.trip_id = b.trip_id
    JOIN routes r ON r.route_id = tp.route_id
    JOIN stop_times d ON d.trip_id = b.trip_id AND d.stop_sequence > b.stop_sequence AND d.stop_id = p_dest_stop
    WHERE tp.route_id IN (SELECT route_id FROM dest_routes)
      AND tp.service_id IN (SELECT service_id FROM active)
      -- The bus must still be catchable after the walk to its stop.
      AND gtfs_seconds(b.departure_time) >= p_after_seconds + n.walk_min * 60
      AND gtfs_seconds(b.departure_time) <= p_after_seconds + 10800
  )
  SELECT DISTINCT ON (depart_sec, route_id, stop_id)
         stop_id, stop_name, distance_m, walk_min,
         route_id, route_short_name, route_long_name, trip_headsign,
         depart_sec, arrive_sec,
         ((arrive_sec - depart_sec) / 60)::integer,
         (SELECT s.stop_name FROM stops s WHERE s.stop_id = p_dest_stop)
  FROM rides
  ORDER BY depart_sec, route_id, stop_id
  LIMIT p_limit;
$function$;

GRANT EXECUTE ON FUNCTION public.connecting_departures(numeric, numeric, text, integer, integer, integer) TO anon, authenticated, service_role;
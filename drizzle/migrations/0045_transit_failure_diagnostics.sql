-- Privacy-safe transit diagnostics. This function never returns coordinates,
-- addresses, stop names, trip ids, or rider-identifying data. It only reports
-- the earliest useful stage explaining why the generalized planner returned
-- no itinerary.
CREATE OR REPLACE FUNCTION public.diagnose_transit_general(
  p_origin_lat numeric,
  p_origin_lon numeric,
  p_dest_lat numeric,
  p_dest_lon numeric,
  p_after_seconds integer DEFAULT NULL,
  p_origin_radius_m integer DEFAULT 4000,
  p_dest_radius_m integer DEFAULT 3000
)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH v AS MATERIALIZED (
    SELECT coalesce(
      p_after_seconds,
      extract(hour FROM now() AT TIME ZONE 'Pacific/Honolulu')::int * 3600
        + extract(minute FROM now() AT TIME ZONE 'Pacific/Honolulu')::int * 60
        + extract(second FROM now() AT TIME ZONE 'Pacific/Honolulu')::int
    ) AS after_sec
  ),
  active AS MATERIALIZED (
    SELECT DISTINCT service_id FROM active_service_ids()
  ),
  origins AS MATERIALIZED (
    SELECT n.stop_id, ceil(n.distance_m / 80.47)::integer AS walk_min
    FROM nearby_stops(p_origin_lat, p_origin_lon, p_origin_radius_m) n
  ),
  destinations AS MATERIALIZED (
    SELECT n.stop_id, ceil(n.distance_m / 80.47)::integer AS walk_min
    FROM nearby_stops(p_dest_lat, p_dest_lon, p_dest_radius_m) n
  ),
  origin_departures AS MATERIALIZED (
    SELECT a.trip_id, a.stop_id, gtfs_seconds(a.departure_time) AS dep_sec
    FROM origins o
    JOIN stop_times a ON a.stop_id = o.stop_id
    JOIN trips t ON t.trip_id = a.trip_id
    JOIN routes r ON r.route_id = t.route_id AND r.route_type IN (1, 3)
    WHERE t.service_id IN (SELECT service_id FROM active)
      AND gtfs_seconds(a.departure_time) >= (SELECT after_sec FROM v) + o.walk_min * 60
      AND gtfs_seconds(a.departure_time) <= (SELECT after_sec FROM v) + 10800
  ),
  direct AS MATERIALIZED (
    SELECT 1
    FROM origin_departures a
    JOIN stop_times b ON b.trip_id = a.trip_id AND b.stop_sequence > (
      SELECT min(st.stop_sequence) FROM stop_times st
      WHERE st.trip_id = a.trip_id AND st.stop_id = a.stop_id
    )
    JOIN destinations d ON d.stop_id = b.stop_id
    LIMIT 1
  )
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM active) THEN 'NO_ACTIVE_SERVICE'
    WHEN NOT EXISTS (SELECT 1 FROM origins) THEN 'NO_ORIGIN_STOPS'
    WHEN NOT EXISTS (SELECT 1 FROM destinations) THEN 'NO_DESTINATION_STOPS'
    WHEN NOT EXISTS (SELECT 1 FROM origin_departures) THEN 'NO_REACHABLE_DEPARTURES'
    ELSE 'NO_VALID_ITINERARY'
  END;
$$;

GRANT EXECUTE ON FUNCTION public.diagnose_transit_general(numeric,numeric,numeric,numeric,integer,integer,integer)
  TO anon, authenticated, service_role;

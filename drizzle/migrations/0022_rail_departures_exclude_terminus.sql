-- A trip that ends at this stop is dropping passengers off, not departing. At a
-- terminus that produced a phantom direction headed by the rider's own station.
CREATE OR REPLACE FUNCTION public.rail_departures(
  p_home_stop text,
  p_after_seconds integer DEFAULT NULL,
  p_limit integer DEFAULT 4
)
RETURNS TABLE(
  trip_id text,
  route_id text,
  route_long_name text,
  route_short_name text,
  trip_headsign text,
  stop_name text,
  departure_time text,
  departure_seconds integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH directions AS MATERIALIZED (
    SELECT DISTINCT t.route_id, t.trip_headsign
    FROM stop_times st
    JOIN trips t ON t.trip_id = st.trip_id
    JOIN routes r ON r.route_id = t.route_id
    WHERE st.stop_id = p_home_stop
      AND r.route_type = 1
      AND t.service_id IN (SELECT a.service_id FROM active_service_ids() a)
      AND EXISTS (
        SELECT 1 FROM stop_times st_after
        WHERE st_after.trip_id = st.trip_id
          AND st_after.stop_sequence > st.stop_sequence
      )
      AND gtfs_seconds(st.departure_time) >= coalesce(
        p_after_seconds,
        extract(hour FROM now() AT TIME ZONE 'Pacific/Honolulu')::int * 3600
          + extract(minute FROM now() AT TIME ZONE 'Pacific/Honolulu')::int * 60
      )
  )
  SELECT x.trip_id, x.route_id, x.route_long_name, x.route_short_name,
         x.trip_headsign, x.stop_name, x.departure_time, x.departure_seconds
  FROM directions d
  CROSS JOIN LATERAL (
    SELECT t.trip_id, r.route_id, r.route_long_name, r.route_short_name,
           t.trip_headsign, s.stop_name, st.departure_time,
           gtfs_seconds(st.departure_time) AS departure_seconds
    FROM stop_times st
    JOIN trips t ON t.trip_id = st.trip_id
    JOIN routes r ON r.route_id = t.route_id
    JOIN stops s ON s.stop_id = st.stop_id
    WHERE st.stop_id = p_home_stop
      AND r.route_id = d.route_id
      AND r.route_type = 1
      AND t.trip_headsign IS NOT DISTINCT FROM d.trip_headsign
      AND t.service_id IN (SELECT a.service_id FROM active_service_ids() a)
      AND EXISTS (
        SELECT 1 FROM stop_times st_after
        WHERE st_after.trip_id = st.trip_id
          AND st_after.stop_sequence > st.stop_sequence
      )
      AND gtfs_seconds(st.departure_time) >= coalesce(
        p_after_seconds,
        extract(hour FROM now() AT TIME ZONE 'Pacific/Honolulu')::int * 3600
          + extract(minute FROM now() AT TIME ZONE 'Pacific/Honolulu')::int * 60
      )
    ORDER BY gtfs_seconds(st.departure_time)
    LIMIT p_limit
  ) x
  ORDER BY x.departure_seconds;
$$;

GRANT EXECUTE ON FUNCTION public.rail_departures(text, integer, integer) TO anon, authenticated, service_role;
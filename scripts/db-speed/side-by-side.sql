-- Side-by-side rehearsal for migration 0063 (NOT a migration).
-- Creates stop_modes and the new function under a temporary _v2 name so
-- scripts/db-speed/compare.mts can check old vs new answers before switching.
-- Generated from 0063; the function bodies are identical apart from the
-- name. The live functions and swap_gtfs_staging() are not touched.
-- Remove with scripts/db-speed/cleanup.sql after the switch.

BEGIN;

-- 1. Which service types (routes.route_type) call at each stop.
CREATE TABLE IF NOT EXISTS public.stop_modes (
  stop_id text NOT NULL,
  route_type integer NOT NULL,
  PRIMARY KEY (stop_id, route_type)
);
-- Read only through SECURITY DEFINER functions; no direct API access.
ALTER TABLE public.stop_modes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stop_modes FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.stop_modes TO service_role;

-- Derived data: rebuilt from the live feed, so safe to re-run.
TRUNCATE public.stop_modes;
INSERT INTO public.stop_modes (stop_id, route_type)
SELECT DISTINCT st.stop_id, r.route_type
FROM public.stop_times st
JOIN public.trips t ON t.trip_id = st.trip_id
JOIN public.routes r ON r.route_id = t.route_id
WHERE r.route_type IS NOT NULL;
ANALYZE public.stop_modes;

CREATE OR REPLACE FUNCTION public.nearby_transit_stops_v2(
  p_lat numeric,
  p_lon numeric,
  p_after_seconds integer DEFAULT NULL,
  p_rail_limit integer DEFAULT 2,
  p_bus_limit integer DEFAULT 5
)
RETURNS TABLE(
  stop_id text,
  stop_name text,
  stop_lat numeric,
  stop_lon numeric,
  route_type integer,
  distance_m double precision,
  arrivals jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH active AS MATERIALIZED (
    SELECT DISTINCT a.service_id FROM public.active_service_ids() a
  ),
  served AS MATERIALIZED (
    SELECT s.stop_id, s.stop_name, s.stop_lat, s.stop_lon, m.route_type
    FROM public.stops s
    JOIN public.stop_modes m ON m.stop_id = s.stop_id
    WHERE s.stop_lat IS NOT NULL
      AND s.stop_lon IS NOT NULL
      AND m.route_type IN (1, 3)
      AND s.stop_lat BETWEEN p_lat - 0.06 AND p_lat + 0.06
      AND s.stop_lon BETWEEN p_lon - 0.06 AND p_lon + 0.06
      AND EXISTS (
        SELECT 1
        FROM public.stop_times st
        JOIN public.trips t ON t.trip_id = st.trip_id
        JOIN public.routes r ON r.route_id = t.route_id
        JOIN active a ON a.service_id = t.service_id
        WHERE st.stop_id = s.stop_id
          AND r.route_type = m.route_type
      )
  ),
  ranked AS MATERIALIZED (
    SELECT served.*,
      public.gtfs_distance_m(p_lat, p_lon, stop_lat, stop_lon) AS distance_m,
      row_number() OVER (
        PARTITION BY route_type
        ORDER BY public.gtfs_distance_m(p_lat, p_lon, stop_lat, stop_lon)
      ) AS proximity_rank
    FROM served
  ),
  chosen AS MATERIALIZED (
    SELECT * FROM ranked
    WHERE (route_type = 1 AND proximity_rank <= greatest(1, least(p_rail_limit, 4)))
       OR (route_type = 3 AND proximity_rank <= greatest(1, least(p_bus_limit, 8)))
  )
  SELECT c.stop_id, c.stop_name, c.stop_lat, c.stop_lon, c.route_type, c.distance_m,
    coalesce(next_arrivals.items, '[]'::jsonb) AS arrivals
  FROM chosen c
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object(
      'departure_seconds', d.departure_seconds,
      'departure_time', d.departure_time,
      'route_short_name', d.route_short_name,
      'route_long_name', d.route_long_name,
      'headsign', d.trip_headsign
    ) ORDER BY d.departure_seconds) AS items
    FROM (
      SELECT public.gtfs_seconds(st.departure_time) AS departure_seconds,
        st.departure_time,
        r.route_short_name,
        r.route_long_name,
        t.trip_headsign
      FROM public.stop_times st
      JOIN public.trips t ON t.trip_id = st.trip_id
      JOIN public.routes r ON r.route_id = t.route_id
      JOIN active a ON a.service_id = t.service_id
      WHERE st.stop_id = c.stop_id
        AND r.route_type = c.route_type
        AND public.gtfs_seconds(st.departure_time) >= coalesce(p_after_seconds,
          extract(hour from now() AT TIME ZONE 'Pacific/Honolulu')::int * 3600
          + extract(minute from now() AT TIME ZONE 'Pacific/Honolulu')::int * 60
          + extract(second from now() AT TIME ZONE 'Pacific/Honolulu')::int)
      ORDER BY public.gtfs_seconds(st.departure_time)
      LIMIT 3
    ) d
  ) next_arrivals ON true
  ORDER BY c.route_type, c.distance_m;
$$;
GRANT EXECUTE ON FUNCTION public.nearby_transit_stops_v2(numeric, numeric, integer, integer, integer) TO anon, authenticated, service_role;

COMMIT;

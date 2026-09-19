CREATE TABLE public.trip_updates (
  trip_id text NOT NULL,
  stop_id text NOT NULL,
  delay_seconds integer,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (trip_id, stop_id)
);

GRANT SELECT ON public.trip_updates TO anon, authenticated;
GRANT ALL ON public.trip_updates TO service_role;

ALTER TABLE public.trip_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read trip_updates" ON public.trip_updates
  FOR SELECT TO anon, authenticated USING (true);

CREATE INDEX trip_updates_stop_idx ON public.trip_updates (stop_id);
CREATE INDEX trip_updates_fetched_at_idx ON public.trip_updates (fetched_at DESC);

DROP FUNCTION IF EXISTS public.next_departures(text, integer);

CREATE FUNCTION public.next_departures(p_station_query text, p_limit integer DEFAULT 4)
 RETURNS TABLE(departure_time text, trip_headsign text, stop_name text, route_short_name text, trip_id text, stop_id text, delay_seconds integer, realtime_fetched_at timestamptz)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  hnl_date date := (now() AT TIME ZONE 'Pacific/Honolulu')::date;
  hnl_time text := to_char(now() AT TIME ZONE 'Pacific/Honolulu', 'HH24:MI:SS');
  hnl_date_text text := to_char((now() AT TIME ZONE 'Pacific/Honolulu')::date, 'YYYYMMDD');
  dow int := extract(isodow FROM (now() AT TIME ZONE 'Pacific/Honolulu')::date);
  needle text := regexp_replace(lower(coalesce(p_station_query, '')), '[^a-z0-9]', '', 'g');
BEGIN
  RETURN QUERY
  WITH active AS (
    SELECT c.service_id
    FROM calendar c
    WHERE to_date(c.start_date, 'YYYYMMDD') <= hnl_date
      AND to_date(c.end_date, 'YYYYMMDD') >= hnl_date
      AND CASE dow
            WHEN 1 THEN c.monday WHEN 2 THEN c.tuesday WHEN 3 THEN c.wednesday
            WHEN 4 THEN c.thursday WHEN 5 THEN c.friday WHEN 6 THEN c.saturday
            ELSE c.sunday END = 1
      AND NOT EXISTS (
        SELECT 1 FROM calendar_dates cd
        WHERE cd.service_id = c.service_id AND cd.date = hnl_date_text AND cd.exception_type = 2
      )
    UNION
    SELECT cd.service_id FROM calendar_dates cd
    WHERE cd.date = hnl_date_text AND cd.exception_type = 1
  )
  SELECT st.departure_time, t.trip_headsign, s.stop_name, r.route_short_name,
         st.trip_id, st.stop_id, tu.delay_seconds, tu.fetched_at
  FROM stop_times st
  JOIN stops s ON s.stop_id = st.stop_id
  JOIN trips t ON t.trip_id = st.trip_id
  JOIN routes r ON r.route_id = t.route_id
  LEFT JOIN trip_updates tu ON tu.trip_id = st.trip_id AND tu.stop_id = st.stop_id
  WHERE regexp_replace(lower(s.stop_name), '[^a-z0-9]', '', 'g') LIKE '%' || needle || '%'
    AND r.route_type = 1
    AND st.departure_time >= hnl_time
    AND t.service_id IN (SELECT service_id FROM active)
  ORDER BY st.departure_time
  LIMIT p_limit;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.next_departures(text, integer) TO anon, authenticated;

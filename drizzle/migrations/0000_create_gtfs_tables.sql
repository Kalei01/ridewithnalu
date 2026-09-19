CREATE TABLE public.stops (
  stop_id text PRIMARY KEY,
  stop_name text,
  stop_lat numeric,
  stop_lon numeric,
  location_type int
);

CREATE TABLE public.routes (
  route_id text PRIMARY KEY,
  route_short_name text,
  route_long_name text,
  route_type int
);

CREATE TABLE public.trips (
  trip_id text PRIMARY KEY,
  route_id text,
  service_id text,
  trip_headsign text,
  direction_id int
);

CREATE TABLE public.stop_times (
  trip_id text NOT NULL,
  stop_id text NOT NULL,
  arrival_time text,
  departure_time text,
  stop_sequence int NOT NULL,
  PRIMARY KEY (trip_id, stop_sequence)
);

CREATE TABLE public.calendar (
  service_id text PRIMARY KEY,
  monday int,
  tuesday int,
  wednesday int,
  thursday int,
  friday int,
  saturday int,
  sunday int,
  start_date text,
  end_date text
);

CREATE TABLE public.calendar_dates (
  service_id text NOT NULL,
  date text NOT NULL,
  exception_type int,
  PRIMARY KEY (service_id, date)
);

CREATE INDEX stop_times_stop_departure_idx ON public.stop_times (stop_id, departure_time);
CREATE INDEX stop_times_trip_idx ON public.stop_times (trip_id);
CREATE INDEX trips_route_idx ON public.trips (route_id);
CREATE INDEX stops_stop_name_idx ON public.stops (stop_name);

GRANT SELECT ON public.stops TO anon, authenticated;
GRANT SELECT ON public.routes TO anon, authenticated;
GRANT SELECT ON public.trips TO anon, authenticated;
GRANT SELECT ON public.stop_times TO anon, authenticated;
GRANT SELECT ON public.calendar TO anon, authenticated;
GRANT SELECT ON public.calendar_dates TO anon, authenticated;
GRANT ALL ON public.stops TO service_role;
GRANT ALL ON public.routes TO service_role;
GRANT ALL ON public.trips TO service_role;
GRANT ALL ON public.stop_times TO service_role;
GRANT ALL ON public.calendar TO service_role;
GRANT ALL ON public.calendar_dates TO service_role;

ALTER TABLE public.stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stop_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read stops" ON public.stops FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read routes" ON public.routes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read trips" ON public.trips FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read stop_times" ON public.stop_times FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read calendar" ON public.calendar FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read calendar_dates" ON public.calendar_dates FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.next_departures(p_station_query text, p_limit int DEFAULT 4)
RETURNS TABLE (departure_time text, trip_headsign text, stop_name text, route_short_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hnl_date date := (now() AT TIME ZONE 'Pacific/Honolulu')::date;
  hnl_time text := to_char(now() AT TIME ZONE 'Pacific/Honolulu', 'HH24:MI:SS');
  hnl_date_text text := to_char((now() AT TIME ZONE 'Pacific/Honolulu')::date, 'YYYYMMDD');
  dow int := extract(isodow FROM (now() AT TIME ZONE 'Pacific/Honolulu')::date);
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
  SELECT st.departure_time, t.trip_headsign, s.stop_name, r.route_short_name
  FROM stop_times st
  JOIN stops s ON s.stop_id = st.stop_id
  JOIN trips t ON t.trip_id = st.trip_id
  JOIN routes r ON r.route_id = t.route_id
  WHERE s.stop_name ILIKE '%' || p_station_query || '%'
    AND r.route_type = 1
    AND st.departure_time >= hnl_time
    AND t.service_id IN (SELECT service_id FROM active)
  ORDER BY st.departure_time
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_departures(text, int) TO anon, authenticated;
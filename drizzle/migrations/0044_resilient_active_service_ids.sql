-- Keep transit planning usable when the GTFS calendar feed rolls over a short
-- boundary before the next schedule refresh. Prefer today's exact service set;
-- only fall back to the most recent matching weekday service when today's exact
-- set is empty. This prevents a temporary calendar rollover from making all
-- transit disappear while keeping the fallback bounded and schedule-only.
CREATE OR REPLACE FUNCTION public.active_service_ids()
RETURNS TABLE(service_id text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH d AS (
    SELECT
      (now() AT TIME ZONE 'Pacific/Honolulu')::date AS today,
      to_char((now() AT TIME ZONE 'Pacific/Honolulu')::date, 'YYYYMMDD') AS today_text,
      extract(isodow FROM (now() AT TIME ZONE 'Pacific/Honolulu')::date)::integer AS dow
  ),
  exact AS MATERIALIZED (
    SELECT c.service_id
    FROM calendar c, d
    WHERE to_date(c.start_date, 'YYYYMMDD') <= d.today
      AND to_date(c.end_date, 'YYYYMMDD') >= d.today
      AND CASE d.dow
            WHEN 1 THEN c.monday WHEN 2 THEN c.tuesday WHEN 3 THEN c.wednesday
            WHEN 4 THEN c.thursday WHEN 5 THEN c.friday WHEN 6 THEN c.saturday
            ELSE c.sunday END = 1
      AND NOT EXISTS (
        SELECT 1
        FROM calendar_dates cd
        WHERE cd.service_id = c.service_id
          AND cd.date = d.today_text
          AND cd.exception_type = 2
      )
    UNION
    SELECT cd.service_id
    FROM calendar_dates cd, d
    WHERE cd.date = d.today_text
      AND cd.exception_type = 1
  ),
  fallback AS MATERIALIZED (
    SELECT c.service_id
    FROM calendar c, d
    WHERE to_date(c.end_date, 'YYYYMMDD') < d.today
      AND d.today - to_date(c.end_date, 'YYYYMMDD') <= 14
      AND CASE d.dow
            WHEN 1 THEN c.monday WHEN 2 THEN c.tuesday WHEN 3 THEN c.wednesday
            WHEN 4 THEN c.thursday WHEN 5 THEN c.friday WHEN 6 THEN c.saturday
            ELSE c.sunday END = 1
      AND NOT EXISTS (
        SELECT 1
        FROM calendar_dates cd
        WHERE cd.service_id = c.service_id
          AND cd.date = d.today_text
          AND cd.exception_type = 2
      )
  )
  SELECT e.service_id FROM exact e
  UNION ALL
  SELECT f.service_id
  FROM fallback f
  WHERE NOT EXISTS (SELECT 1 FROM exact);
$$;

GRANT EXECUTE ON FUNCTION public.active_service_ids() TO anon, authenticated, service_role;

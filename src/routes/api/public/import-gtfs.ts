import { createFileRoute } from "@tanstack/react-router";
import { Unzip, AsyncUnzipInflate } from "fflate";

const GTFS_URL = "https://www.thebus.org/transitdata/production/google_transit.zip";

/**
 * Configurable allow-list. Only stops whose stop_name matches one of these
 * (case-insensitive substring) are imported, together with the stop_times that
 * serve them. This keeps the dataset far below free-tier storage limits.
 * Skyline rail is inside TheBus feed as route_type 1.
 */
const STOP_NAME_FILTERS = [
  "East Kapolei",
  "Kualakai",
  "UH West Oahu",
  "Keoneae",
  "Hoopili",
  "Honouliuli",
  "West Loch",
  "Hoaeae",
  "Waipahu Transit Center",
  "Pouhala",
  "Leeward Community College",
  "Halaulani",
  "Pearl Highlands",
  "Waiawa",
  "Halawa",
  "Aloha Stadium",
  "Middle Street",
  "Kalihi",
  "Alapai Transit Center",
  "Downtown",
];

/** Optional explicit stop_id allow-list; when non-empty it is added to the name matches. */
const STOP_ID_FILTERS: string[] = [];

type Row = Record<string, string>;

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      out.push(field);
      field = "";
    } else field += char;
  }
  out.push(field);
  return out;
}

function num(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Streams the zip and calls onRow for each CSV row of the requested files,
 * so no full .txt file is ever held in memory (stop_times.txt is huge).
 */
async function streamZip(
  buffer: Uint8Array,
  wanted: Set<string>,
  onRow: (file: string, row: Row) => void,
) {
  await new Promise<void>((resolve, reject) => {
    const unzip = new Unzip();
    unzip.register(AsyncUnzipInflate);
    const decoder = new TextDecoder();
    let pending = 0;
    let pushed = false;

    const finish = () => {
      if (pushed && pending === 0) resolve();
    };

    unzip.onfile = (file) => {
      const name = file.name.split("/").pop() ?? file.name;
      if (!wanted.has(name)) return;
      pending += 1;
      let rest = "";
      let header: string[] | null = null;

      const handleLine = (line: string) => {
        if (line === "") return;
        const cells = splitCsvLine(line.replace(/\r$/, ""));
        if (!header) {
          header = cells.map((cell) => cell.replace(/^\uFEFF/, "").trim());
          return;
        }
        const row: Row = {};
        header.forEach((key, index) => {
          row[key] = (cells[index] ?? "").trim();
        });
        onRow(name, row);
      };

      file.ondata = (err, chunk, final) => {
        if (err) {
          reject(err);
          return;
        }
        rest += decoder.decode(chunk, { stream: !final });
        const lines = rest.split("\n");
        rest = lines.pop() ?? "";
        for (const line of lines) handleLine(line);
        if (final) {
          if (rest) handleLine(rest);
          pending -= 1;
          finish();
        }
      };
      file.start();
    };

    try {
      unzip.push(buffer, true);
      pushed = true;
      finish();
    } catch (error) {
      reject(error);
    }
  });
}

export const Route = createFileRoute("/api/public/import-gtfs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("apikey") ?? "";
        const expected = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? "";
        if (!expected || key !== expected) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const response = await fetch(GTFS_URL);
        if (!response.ok) {
          return Response.json(
            { error: `Feed download failed (${response.status})` },
            { status: 502 },
          );
        }
        const buffer = new Uint8Array(await response.arrayBuffer());

        // Pass 1: small files.
        const stops: Row[] = [];
        const routes = new Map<string, Row>();
        const trips = new Map<string, Row>();
        const calendar: Row[] = [];
        const calendarDates: Row[] = [];

        await streamZip(
          buffer,
          new Set(["stops.txt", "routes.txt", "trips.txt", "calendar.txt", "calendar_dates.txt"]),
          (file, row) => {
            if (file === "stops.txt") stops.push(row);
            else if (file === "routes.txt") routes.set(row["route_id"]!, row);
            else if (file === "trips.txt") trips.set(row["trip_id"]!, row);
            else if (file === "calendar.txt") calendar.push(row);
            else calendarDates.push(row);
          },
        );

        const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
        const filters = STOP_NAME_FILTERS.map(normalize);
        const relevantStops = stops.filter((stop) => {
          if (STOP_ID_FILTERS.includes(stop["stop_id"] ?? "")) return true;
          const name = normalize(stop["stop_name"] ?? "");
          return filters.some((filter) => name.includes(filter));
        });
        const relevantStopIds = new Set(relevantStops.map((stop) => stop["stop_id"]!));

        // Pass 2: stop_times, filtered to relevant stops only.
        const stopTimes: Array<Record<string, unknown>> = [];
        const usedTripIds = new Set<string>();
        await streamZip(buffer, new Set(["stop_times.txt"]), (_file, row) => {
          const stopId = row["stop_id"] ?? "";
          if (!relevantStopIds.has(stopId)) return;
          usedTripIds.add(row["trip_id"]!);
          stopTimes.push({
            trip_id: row["trip_id"],
            stop_id: stopId,
            arrival_time: row["arrival_time"] || null,
            departure_time: row["departure_time"] || null,
            stop_sequence: num(row["stop_sequence"]) ?? 0,
          });
        });

        const relevantTrips = [...usedTripIds]
          .map((id) => trips.get(id))
          .filter((trip): trip is Row => Boolean(trip));
        const usedRouteIds = new Set(relevantTrips.map((trip) => trip["route_id"]!));
        const usedServiceIds = new Set(relevantTrips.map((trip) => trip["service_id"]!));

        const upsert = async (
          table: "stops" | "routes" | "trips" | "stop_times" | "calendar" | "calendar_dates",
          rows: Array<Record<string, unknown>>,
          onConflict: string,
        ) => {
          for (let i = 0; i < rows.length; i += 1000) {
            const { error } = await supabaseAdmin
              .from(table)
              .upsert(rows.slice(i, i + 1000) as never, { onConflict });
            if (error) throw new Error(`${table}: ${error.message}`);
          }
          return rows.length;
        };

        const counts = {
          stops: await upsert(
            "stops",
            relevantStops.map((stop) => ({
              stop_id: stop["stop_id"],
              stop_name: stop["stop_name"] ?? null,
              stop_lat: num(stop["stop_lat"]),
              stop_lon: num(stop["stop_lon"]),
              location_type: num(stop["location_type"]),
            })),
            "stop_id",
          ),
          routes: await upsert(
            "routes",
            [...usedRouteIds]
              .map((id) => routes.get(id))
              .filter((route): route is Row => Boolean(route))
              .map((route) => ({
                route_id: route["route_id"],
                route_short_name: route["route_short_name"] ?? null,
                route_long_name: route["route_long_name"] ?? null,
                route_type: num(route["route_type"]),
              })),
            "route_id",
          ),
          trips: await upsert(
            "trips",
            relevantTrips.map((trip) => ({
              trip_id: trip["trip_id"],
              route_id: trip["route_id"] ?? null,
              service_id: trip["service_id"] ?? null,
              trip_headsign: trip["trip_headsign"] ?? null,
              direction_id: num(trip["direction_id"]),
            })),
            "trip_id",
          ),
          calendar: await upsert(
            "calendar",
            calendar
              .filter((row) => usedServiceIds.has(row["service_id"]!))
              .map((row) => ({
                service_id: row["service_id"],
                monday: num(row["monday"]),
                tuesday: num(row["tuesday"]),
                wednesday: num(row["wednesday"]),
                thursday: num(row["thursday"]),
                friday: num(row["friday"]),
                saturday: num(row["saturday"]),
                sunday: num(row["sunday"]),
                start_date: row["start_date"] ?? null,
                end_date: row["end_date"] ?? null,
              })),
            "service_id",
          ),
          calendar_dates: await upsert(
            "calendar_dates",
            calendarDates
              .filter((row) => usedServiceIds.has(row["service_id"]!))
              .map((row) => ({
                service_id: row["service_id"],
                date: row["date"],
                exception_type: num(row["exception_type"]),
              })),
            "service_id,date",
          ),
          stop_times: await upsert("stop_times", stopTimes, "trip_id,stop_sequence"),
        };

        console.log("import-gtfs rows landed:", counts);
        return Response.json({ success: true, counts });
      },
    },
  },
});

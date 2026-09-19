import { createFileRoute } from "@tanstack/react-router";
import { Unzip, AsyncUnzipInflate } from "fflate";

const GTFS_URL = "https://www.thebus.org/transitdata/production/google_transit.zip";

/**
 * Every stop and route in the feed is imported. stop_times is limited to the
 * stops that matter for a rail-vs-drive answer: stops served by Skyline rail
 * (route_type 1) plus any stop within RAIL_WALK_RADIUS_M of a rail station,
 * which is how connecting bus routes get included.
 */
const RAIL_WALK_RADIUS_M = 400;

/** Above this many stop_times rows, trips outside the current service window are dropped. */
const STOP_TIMES_SOFT_CAP = 600_000;

/** Metres between two coordinates (haversine). */
function distanceMeters(
  latA: number,
  lonA: number,
  latB: number,
  lonB: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(latB - latA);
  const dLon = toRad(lonB - lonA);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(latA)) * Math.cos(toRad(latB)) * Math.sin(dLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}


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

        // Skyline rail is route_type 1 inside TheBus feed.
        const railRouteIds = new Set(
          [...routes.values()]
            .filter((route) => num(route["route_type"]) === 1)
            .map((route) => route["route_id"]!),
        );
        const railTripIds = new Set(
          [...trips.values()]
            .filter((trip) => railRouteIds.has(trip["route_id"] ?? ""))
            .map((trip) => trip["trip_id"]!),
        );

        // Pass 2: find which stops rail trips actually serve.
        const railStopIds = new Set<string>();
        await streamZip(buffer, new Set(["stop_times.txt"]), (_file, row) => {
          if (railTripIds.has(row["trip_id"] ?? "")) railStopIds.add(row["stop_id"]!);
        });

        // Target stops = rail stops + everything within walking distance of one,
        // which pulls in the connecting bus routes at those stations.
        const coords = stops
          .map((stop) => ({
            id: stop["stop_id"]!,
            lat: num(stop["stop_lat"]),
            lon: num(stop["stop_lon"]),
          }))
          .filter((stop) => stop.lat !== null && stop.lon !== null) as Array<{
          id: string;
          lat: number;
          lon: number;
        }>;
        const railCoords = coords.filter((stop) => railStopIds.has(stop.id));
        const targetStopIds = new Set(railStopIds);
        for (const stop of coords) {
          if (targetStopIds.has(stop.id)) continue;
          if (
            railCoords.some(
              (station) =>
                distanceMeters(stop.lat, stop.lon, station.lat, station.lon) <=
                RAIL_WALK_RADIUS_M,
            )
          ) {
            targetStopIds.add(stop.id);
          }
        }

        // Services running in the current calendar window (used only if we must trim).
        const today = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Pacific/Honolulu",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })
          .format(new Date())
          .replace(/-/g, "");
        const activeServiceIds = new Set(
          calendar
            .filter(
              (row) =>
                (row["start_date"] ?? "") <= today && (row["end_date"] ?? "") >= today,
            )
            .map((row) => row["service_id"]!),
        );
        for (const row of calendarDates) {
          if (row["date"] === today && num(row["exception_type"]) === 1) {
            activeServiceIds.add(row["service_id"]!);
          }
        }
        const activeTripIds = new Set(
          [...trips.values()]
            .filter((trip) => activeServiceIds.has(trip["service_id"] ?? ""))
            .map((trip) => trip["trip_id"]!),
        );

        // Pass 3: count first so we can decide whether trimming is needed,
        // without holding an oversized array in memory.
        let candidateRows = 0;
        let activeRows = 0;
        await streamZip(buffer, new Set(["stop_times.txt"]), (_file, row) => {
          if (!targetStopIds.has(row["stop_id"] ?? "")) return;
          candidateRows += 1;
          if (activeTripIds.has(row["trip_id"] ?? "")) activeRows += 1;
        });
        const trimToActive = candidateRows > STOP_TIMES_SOFT_CAP;

        // Pass 4: collect the stop_times we keep.
        const stopTimes: Array<Record<string, unknown>> = [];
        const usedTripIds = new Set<string>();
        await streamZip(buffer, new Set(["stop_times.txt"]), (_file, row) => {
          const stopId = row["stop_id"] ?? "";
          const tripId = row["trip_id"] ?? "";
          if (!targetStopIds.has(stopId)) return;
          if (trimToActive && !activeTripIds.has(tripId)) return;
          usedTripIds.add(tripId);
          stopTimes.push({
            trip_id: tripId,
            stop_id: stopId,
            arrival_time: row["arrival_time"] || null,
            departure_time: row["departure_time"] || null,
            stop_sequence: num(row["stop_sequence"]) ?? 0,
          });
        });

        const relevantTrips = [...usedTripIds]
          .map((id) => trips.get(id))
          .filter((trip): trip is Row => Boolean(trip));
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
            stops.map((stop) => ({
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
            [...routes.values()].map((route) => ({
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

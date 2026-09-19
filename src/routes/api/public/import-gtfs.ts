import { createFileRoute } from "@tanstack/react-router";
import { Unzip, AsyncUnzipInflate } from "fflate";

const GTFS_URL = "https://www.thebus.org/transitdata/production/google_transit.zip";

/**
 * Every stop and route in the feed is imported, plus the full stop sequence of
 * every trip whose service is active inside the current schedule window. No
 * station or proximity filtering is applied to stop_times.
 */
const CALENDAR_WINDOW_START = "20260712";
const CALENDAR_WINDOW_END = "20261205";

/** Rows sent per Data API request. */
const BATCH_SIZE = 5_000;



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

        // Services whose calendar window overlaps the current schedule window.
        const overlaps = (row: Row) =>
          (row["start_date"] ?? "") <= CALENDAR_WINDOW_END &&
          (row["end_date"] ?? "") >= CALENDAR_WINDOW_START;
        const activeServiceIds = new Set(
          calendar.filter(overlaps).map((row) => row["service_id"]!),
        );
        for (const row of calendarDates) {
          const date = row["date"] ?? "";
          if (
            num(row["exception_type"]) === 1 &&
            date >= CALENDAR_WINDOW_START &&
            date <= CALENDAR_WINDOW_END
          ) {
            activeServiceIds.add(row["service_id"]!);
          }
        }
        const activeTripIds = new Set(
          [...trips.values()]
            .filter((trip) => activeServiceIds.has(trip["service_id"] ?? ""))
            .map((trip) => trip["trip_id"]!),
        );

        // Pass 2: every stop_time of every active trip — no stop or proximity filter.
        // Rows are held as packed strings to keep peak memory reasonable at ~1-2M rows.
        const packed: string[] = [];
        const usedTripIds = new Set<string>();
        await streamZip(buffer, new Set(["stop_times.txt"]), (_file, row) => {
          const tripId = row["trip_id"] ?? "";
          if (!activeTripIds.has(tripId)) return;
          usedTripIds.add(tripId);
          packed.push(
            [
              tripId,
              row["stop_id"] ?? "",
              row["arrival_time"] ?? "",
              row["departure_time"] ?? "",
              row["stop_sequence"] ?? "0",
            ].join("\u0001"),
          );
        });

        const unpack = (line: string) => {
          const [trip, stop, arrival, departure, sequence] = line.split("\u0001");
          return {
            trip_id: trip,
            stop_id: stop,
            arrival_time: arrival || null,
            departure_time: departure || null,
            stop_sequence: num(sequence) ?? 0,
          };
        };

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
          stop_times: await (async () => {
            for (let i = 0; i < packed.length; i += BATCH_SIZE) {
              const batch = packed.slice(i, i + BATCH_SIZE).map(unpack);
              const { error } = await supabaseAdmin
                .from("stop_times")
                .upsert(batch as never, { onConflict: "trip_id,stop_sequence" });
              if (error) throw new Error(`stop_times: ${error.message}`);
            }
            return packed.length;
          })(),
        };

        const summary = {
          ...counts,
          active_services: activeServiceIds.size,
          active_trips: activeTripIds.size,
          calendar_window: `${CALENDAR_WINDOW_START}-${CALENDAR_WINDOW_END}`,
        };
        console.log("import-gtfs rows landed:", summary);
        return Response.json({ success: true, counts: summary });


      },
    },
  },
});

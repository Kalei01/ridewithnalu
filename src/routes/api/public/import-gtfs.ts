import { createFileRoute } from "@tanstack/react-router";
import { Unzip, UnzipInflate } from "fflate";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

const GTFS_URL = "https://www.thebus.org/transitdata/production/google_transit.zip";

/**
 * Every stop and route in the feed is imported, plus the full stop sequence of
 * every trip whose service is active inside the current calendar window.
 *
 * The import only ever writes to the staging_* tables. Live tables are replaced
 * by one atomic swap after every staging table is fully written, so a run that
 * dies halfway can never put partial data in front of riders.
 */

/** Progress checkpoint size for stop_times. */
const BATCH_SIZE = 10_000;
/** Rows per Data API request inside a batch. */
const CHUNK_SIZE = 1_000;
/** A run that stops updating job_status for this long is treated as stalled. */
const STALL_MINUTES = 10;
/** Soft time budget; when exceeded the run stops and the next call resumes. */
const TIME_BUDGET_MS = 240_000;
/** Reject an unexpectedly large upstream payload before buffering it. */
const MAX_FEED_BYTES = 80 * 1024 * 1024;

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

/** Streams the zip so no full .txt file is ever held in memory. */
async function streamZip(
  buffer: Uint8Array,
  wanted: Set<string>,
  onRow: (file: string, row: Row) => void,
) {
  await new Promise<void>((resolve, reject) => {
    const unzip = new Unzip();
    // Synchronous inflate: AsyncUnzipInflate needs Web Workers, which the
    // Cloudflare Workers runtime does not provide ("Worker is not defined").
    unzip.register(UnzipInflate);
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

type StagingTable =
  | "staging_stops"
  | "staging_routes"
  | "staging_trips"
  | "staging_stop_times"
  | "staging_calendar"
  | "staging_calendar_dates";

export const Route = createFileRoute("/api/public/import-gtfs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // This route performs privileged writes and must never accept the
        // browser-visible publishable key. The scheduler sends a rotating,
        // timing-safe Bearer credential checked by the generated helper.
        const authError = await authenticateCronRequest(request);
        if (authError) return authError;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const startedMs = Date.now();

        // ---- Resume / skip decision -------------------------------------
        const { data: running } = await supabaseAdmin
          .from("job_status")
          .select("job_id, table_name, rows_completed, status, last_updated_at, started_at")
          .eq("status", "running");

        const staleCutoff = Date.now() - STALL_MINUTES * 60_000;
        const fresh = (running ?? []).find(
          (row) => new Date(row.last_updated_at).getTime() > staleCutoff,
        );
        if (fresh) {
          return Response.json({
            skipped: true,
            reason: "another import is still running",
            job_id: fresh.job_id,
            last_updated_at: fresh.last_updated_at,
          });
        }

        const resuming = (running ?? []).length > 0;
        // The hourly watchdog call only ever finishes a stalled run.
        let mode: string | undefined;
        const rawBody = await request.text();
        if (rawBody.trim()) {
          try {
            const body = JSON.parse(rawBody) as unknown;
            mode = body && typeof body === "object" ? (body as { mode?: string }).mode : undefined;
          } catch {
            return Response.json({ error: "Invalid JSON body" }, { status: 400 });
          }
        }
        if (mode !== undefined && mode !== "resume") {
          return Response.json({ error: "Invalid import mode" }, { status: 400 });
        }
        if (mode === "resume" && !resuming) {
          return Response.json({ skipped: true, reason: "nothing to resume" });
        }

        const jobId = resuming
          ? running![0]!.job_id
          : `gtfs-${new Date().toISOString().replace(/[:.]/g, "-")}`;
        const startedAt = resuming ? running![0]!.started_at : new Date().toISOString();

        const progress = new Map<string, number>();
        for (const row of running ?? []) progress.set(row.table_name, row.rows_completed);

        const { data: doneRows } = await supabaseAdmin
          .from("job_status")
          .select("table_name, rows_completed")
          .eq("job_id", jobId)
          .eq("status", "completed");
        const completed = new Map<string, number>(
          (doneRows ?? []).map((row) => [row.table_name, row.rows_completed]),
        );

        const touch = async (
          table: string,
          rowsCompleted: number,
          total: number | null,
          status: "running" | "completed" | "failed",
        ) => {
          await supabaseAdmin.from("job_status").upsert(
            {
              job_id: jobId,
              table_name: table,
              rows_completed: rowsCompleted,
              total_rows_estimated: total,
              started_at: startedAt,
              last_updated_at: new Date().toISOString(),
              status,
            },
            { onConflict: "job_id,table_name" },
          );
        };

        const counts: Record<string, number> = {};

        try {
          await touch("feed", 0, null, "running");

          const response = await fetch(GTFS_URL, { signal: AbortSignal.timeout(60_000) });
          if (!response.ok) throw new Error(`Feed download failed (${response.status})`);
          const declaredBytes = Number(response.headers.get("content-length") ?? 0);
          if (declaredBytes > MAX_FEED_BYTES)
            throw new Error("Feed download exceeded the safe size limit");
          const buffer = new Uint8Array(await response.arrayBuffer());
          if (buffer.byteLength > MAX_FEED_BYTES)
            throw new Error("Feed download exceeded the safe size limit");

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

          // Calendar window is read from the feed itself: services that are
          // active any time from today onward inside their own declared range.
          const today = new Date(
            new Date().toLocaleString("en-US", { timeZone: "Pacific/Honolulu" }),
          );
          const stamp = (date: Date) =>
            `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(
              date.getDate(),
            ).padStart(2, "0")}`;
          const windowStart = stamp(today);
          const windowEnd = calendar.reduce(
            (max, row) => ((row["end_date"] ?? "") > max ? row["end_date"]! : max),
            windowStart,
          );

          const activeServiceIds = new Set(
            calendar
              .filter(
                (row) =>
                  (row["start_date"] ?? "") <= windowEnd && (row["end_date"] ?? "") >= windowStart,
              )
              .map((row) => row["service_id"]!),
          );
          for (const row of calendarDates) {
            const date = row["date"] ?? "";
            if (num(row["exception_type"]) === 1 && date >= windowStart && date <= windowEnd) {
              activeServiceIds.add(row["service_id"]!);
            }
          }
          // Trips outside the active calendar window are dropped before any
          // stop_times work, which is what keeps the volume manageable.
          const activeTripIds = new Set(
            [...trips.values()]
              .filter((trip) => activeServiceIds.has(trip["service_id"] ?? ""))
              .map((trip) => trip["trip_id"]!),
          );

          // Pass 2: stop_times of active trips only, packed to save memory.
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
              trip_id: trip!,
              stop_id: stop!,
              arrival_time: arrival || null,
              departure_time: departure || null,
              stop_sequence: num(sequence) ?? 0,
            };
          };

          const relevantTrips = [...usedTripIds]
            .map((id) => trips.get(id))
            .filter((trip): trip is Row => Boolean(trip));
          const usedServiceIds = new Set(relevantTrips.map((trip) => trip["service_id"]!));

          const loadSmall = async (
            table: StagingTable,
            rows: Array<Record<string, unknown>>,
            onConflict: string,
          ) => {
            if (completed.has(table)) {
              counts[table] = completed.get(table)!;
              return;
            }
            await touch(table, 0, rows.length, "running");
            for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
              const { error } = await supabaseAdmin
                .from(table)
                .upsert(rows.slice(i, i + CHUNK_SIZE) as never, { onConflict });
              if (error) throw new Error(`${table}: ${error.message}`);
            }
            counts[table] = rows.length;
            await touch(table, rows.length, rows.length, "completed");
          };

          await loadSmall(
            "staging_stops",
            stops.map((stop) => ({
              stop_id: stop["stop_id"],
              stop_name: stop["stop_name"] ?? null,
              stop_lat: num(stop["stop_lat"]),
              stop_lon: num(stop["stop_lon"]),
              location_type: num(stop["location_type"]),
            })),
            "stop_id",
          );
          await loadSmall(
            "staging_routes",
            [...routes.values()].map((route) => ({
              route_id: route["route_id"],
              route_short_name: route["route_short_name"] ?? null,
              route_long_name: route["route_long_name"] ?? null,
              route_type: num(route["route_type"]),
            })),
            "route_id",
          );
          await loadSmall(
            "staging_calendar",
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
          );
          await loadSmall(
            "staging_calendar_dates",
            calendarDates
              .filter((row) => usedServiceIds.has(row["service_id"]!))
              .map((row) => ({
                service_id: row["service_id"],
                date: row["date"],
                exception_type: num(row["exception_type"]),
              })),
            "service_id,date",
          );
          await loadSmall(
            "staging_trips",
            relevantTrips.map((trip) => ({
              trip_id: trip["trip_id"],
              route_id: trip["route_id"] ?? null,
              service_id: trip["service_id"] ?? null,
              trip_headsign: trip["trip_headsign"] ?? null,
              direction_id: num(trip["direction_id"]),
            })),
            "trip_id",
          );

          // stop_times: 10k checkpoints, resumable from rows_completed.
          let offset = completed.has("staging_stop_times")
            ? packed.length
            : (progress.get("staging_stop_times") ?? 0);
          await touch("staging_stop_times", offset, packed.length, "running");

          while (offset < packed.length) {
            const batch = packed.slice(offset, offset + BATCH_SIZE);
            for (let i = 0; i < batch.length; i += CHUNK_SIZE) {
              const { error } = await supabaseAdmin
                .from("staging_stop_times")
                .upsert(batch.slice(i, i + CHUNK_SIZE).map(unpack) as never, {
                  onConflict: "trip_id,stop_sequence",
                });
              if (error) throw new Error(`staging_stop_times: ${error.message}`);
            }
            offset += batch.length;
            await touch("staging_stop_times", offset, packed.length, "running");

            if (offset < packed.length && Date.now() - startedMs > TIME_BUDGET_MS) {
              // Leave the job running; the next invocation picks up here.
              return Response.json({
                success: true,
                partial: true,
                job_id: jobId,
                stop_times_loaded: offset,
                stop_times_total: packed.length,
              });
            }
          }
          counts["staging_stop_times"] = packed.length;
          await touch("staging_stop_times", packed.length, packed.length, "completed");

          // ---- Atomic swap ---------------------------------------------
          const { data: swapped, error: swapError } = await supabaseAdmin.rpc("swap_gtfs_staging");
          if (swapError) throw new Error(`swap: ${swapError.message}`);

          const duration = Math.round((Date.now() - startedMs) / 1000);
          await supabaseAdmin.from("job_status").delete().eq("job_id", jobId);
          await supabaseAdmin.from("import_log").insert({
            success: true,
            row_counts: swapped as never,
            duration_seconds: duration,
            error_message: null,
          });
          await supabaseAdmin.rpc("prune_import_log");

          const summary = {
            live_counts: swapped,
            active_services: activeServiceIds.size,
            active_trips: activeTripIds.size,
            calendar_window: `${windowStart}-${windowEnd}`,
            duration_seconds: duration,
            job_id: jobId,
          };
          console.log("import-gtfs swap complete:", summary);
          return Response.json({ success: true, ...summary });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const duration = Math.round((Date.now() - startedMs) / 1000);
          await supabaseAdmin
            .from("job_status")
            .update({ status: "failed", last_updated_at: new Date().toISOString() })
            .eq("job_id", jobId)
            .eq("status", "running");
          await supabaseAdmin.from("import_log").insert({
            success: false,
            row_counts: counts as never,
            duration_seconds: duration,
            error_message: message,
          });
          await supabaseAdmin.rpc("prune_import_log");
          console.error("import-gtfs failed:", message);
          return Response.json({ success: false, error: message }, { status: 500 });
        }
      },
    },
  },
});

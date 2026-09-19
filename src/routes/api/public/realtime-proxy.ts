import { createFileRoute } from "@tanstack/react-router";

const FEED_URL = "https://api.goswift.ly/real-time/thebus/gtfs-rt-trip-updates";

/** Only cache updates for stops we actually import (Skyline + key hubs). */
async function relevantStopIds(supabaseAdmin: {
  from: (table: "stops") => {
    select: (columns: string) => Promise<{ data: Array<{ stop_id: string }> | null; error: unknown }>;
  };
}) {
  const { data } = await supabaseAdmin.from("stops").select("stop_id");
  return new Set((data ?? []).map((row) => row.stop_id));
}

export const Route = createFileRoute("/api/public/realtime-proxy")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("apikey") ?? "";
        const expected = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? "";
        if (!expected || key !== expected) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const feedKey = process.env["SWIFTLY_API_KEY"];
        if (!feedKey) {
          return Response.json(
            { error: "Missing realtime feed credential" },
            { status: 503 },
          );
        }

        const response = await fetch(FEED_URL, { headers: { Authorization: feedKey } });
        if (!response.ok) {
          return Response.json(
            { error: `Realtime feed failed (${response.status})` },
            { status: 502 },
          );
        }

        const { parseTripUpdates } = await import("@/lib/gtfs-realtime.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const buffer = new Uint8Array(await response.arrayBuffer());
        const parsed = parseTripUpdates(buffer);
        const stopIds = await relevantStopIds(supabaseAdmin as never);
        const rows = parsed
          .filter((row) => stopIds.size === 0 || stopIds.has(row.stop_id))
          .map((row) => ({ ...row, fetched_at: new Date().toISOString() }));

        for (let i = 0; i < rows.length; i += 1000) {
          const { error } = await supabaseAdmin
            .from("trip_updates")
            .upsert(rows.slice(i, i + 1000), { onConflict: "trip_id,stop_id" });
          if (error) {
            return Response.json({ error: error.message }, { status: 500 });
          }
        }

        // Drop stale cache entries so nothing older than an hour lingers.
        await supabaseAdmin
          .from("trip_updates")
          .delete()
          .lt("fetched_at", new Date(Date.now() - 60 * 60_000).toISOString());

        console.log("realtime-proxy cached updates:", {
          parsed: parsed.length,
          cached: rows.length,
        });

        return Response.json({
          success: true,
          parsed: parsed.length,
          cached: rows.length,
          fetched_at: new Date().toISOString(),
          updates: rows.slice(0, 50),
        });
      },
    },
  },
});

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MAX_BYTES = 50_000;
const id = z.string().regex(/^[a-z0-9-]{8,64}$/i);

const batch = z.object({
  deviceId: id,
  sessionId: id,
  reason: z.enum(["interval", "trip_end", "failure", "pagehide"]),
  events: z
    .array(
      z.object({
        t: z.number(),
        type: z.string().max(40),
        data: z.record(z.string(), z.union([z.number(), z.boolean(), z.string().max(120), z.null()])).optional(),
      }),
    )
    .max(400),
});

/** Anonymous, short-lived navigation diagnostics (auto-deleted after 48h). */
export const submitDebugLogs = createServerFn({ method: "POST" })
  .inputValidator((data) => batch.parse(data))
  .handler(async ({ data }) => {
    if (JSON.stringify(data.events).length > MAX_BYTES) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("debug_logs").insert({
      device_id: data.deviceId,
      session_id: data.sessionId,
      reason: data.reason,
      events: data.events,
    });
    if (error) console.error("debug log insert failed", error.message);
    return { ok: !error };
  });

export const purgeDebugLogs = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ deviceId: id }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("debug_logs").delete().eq("device_id", data.deviceId);
    return { ok: !error };
  });

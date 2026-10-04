import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const token = z.string().min(20).max(4096);
const point = z.object({
  lat: z.number().min(21).max(22),
  lon: z.number().min(-158.4).max(-157.5),
});
// About one block: enough to plan the trip without storing an exact address.
const roundToBlock = (value: number) => Math.round(value * 1000) / 1000;

const saveSchema = z.object({
  token,
  placeKey: z.string().min(1).max(80),
  placeLabel: z.string().trim().min(1).max(60),
  toHome: z.boolean(),
  origin: point,
  destination: point,
  arriveMin: z.number().int().min(0).max(1439),
  days: z.array(z.number().int().min(1).max(7)).min(1).max(7),
});

/** Turn on (or update) a "Time to leave" alert. Holding the device token is the proof. */
export const saveLeaveAlert = createServerFn({ method: "POST" })
  .inputValidator((input) => saveSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sub } = await supabaseAdmin
      .from("push_subscriptions")
      .select("token, categories")
      .eq("token", data.token)
      .maybeSingle();
    if (!sub) throw new Error("Turn on notifications first.");
    if (!sub.categories.includes("morning_commute")) {
      await supabaseAdmin
        .from("push_subscriptions")
        .update({ categories: [...sub.categories, "morning_commute"], updated_at: new Date().toISOString() })
        .eq("token", data.token);
    }
    const { error } = await supabaseAdmin.from("leave_alerts").upsert({
      token: data.token,
      place_key: data.placeKey,
      place_label: data.placeLabel,
      to_home: data.toHome,
      origin_lat: roundToBlock(data.origin.lat),
      origin_lon: roundToBlock(data.origin.lon),
      dest_lat: roundToBlock(data.destination.lat),
      dest_lon: roundToBlock(data.destination.lon),
      arrive_min: data.arriveMin,
      days: Array.from(new Set(data.days)).sort(),
      next_check_at: null,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error("Could not save the alert.");
    return { ok: true };
  });

/** Turn an alert off; the stored trip is deleted. */
export const removeLeaveAlert = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ token, placeKey: z.string().min(1).max(80) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("leave_alerts")
      .delete()
      .eq("token", data.token)
      .eq("place_key", data.placeKey);
    return { ok: true };
  });

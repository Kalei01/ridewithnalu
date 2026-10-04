import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const categories = z.array(
  z.enum(["morning_commute", "major_traffic", "transit_disruption", "stop_transfer", "urgent_fare_alerts"]),
);
const token = z.string().min(20).max(4096);

const saveSchema = z.object({
  token,
  previousToken: token.optional(),
  categories,
  quietStartMin: z.number().int().min(0).max(1439).nullable(),
  quietEndMin: z.number().int().min(0).max(1439).nullable(),
});

/** Store (or refresh) this device's opt-in. Holding the token is the proof. */
export const savePushSubscription = createServerFn({ method: "POST" })
  .inputValidator((input) => saveSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const renewed = data.previousToken && data.previousToken !== data.token ? data.previousToken : null;
    if (data.categories.length === 0) {
      await supabaseAdmin.from("push_subscriptions").delete().eq("token", data.token);
      if (renewed) await supabaseAdmin.from("push_subscriptions").delete().eq("token", renewed);
      return { ok: true };
    }
    const { error } = await supabaseAdmin.from("push_subscriptions").upsert({
      token: data.token,
      categories: data.categories,
      quiet_start_min: data.quietStartMin,
      quiet_end_min: data.quietEndMin,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error("Could not save notification settings.");
    if (renewed) {
      // The phone got a new token. Move its leave alerts and reminders over
      // before removing the old one, which would otherwise delete them too.
      await supabaseAdmin.from("leave_alerts").update({ token: data.token }).eq("token", renewed);
      await supabaseAdmin.from("scheduled_pushes").update({ token: data.token }).eq("token", renewed);
      await supabaseAdmin.from("push_subscriptions").delete().eq("token", renewed);
    }
    return { ok: true };
  });

export const removePushSubscription = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ token }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("push_subscriptions").delete().eq("token", data.token);
    return { ok: true };
  });

/** Sends one test message to this device, ignoring quiet hours by category. */
export const sendTestPush = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ token }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sub } = await supabaseAdmin
      .from("push_subscriptions")
      .select("token, categories, quiet_start_min, quiet_end_min")
      .eq("token", data.token)
      .maybeSingle();
    if (!sub) return { status: "not-subscribed" as const };
    const { sendToSubscription } = await import("./push.server");
    const status = await sendToSubscription(
      { ...sub, categories: [...sub.categories, "stop_transfer"] },
      {
        category: "stop_transfer",
        title: "Nalu notifications are on",
        body: "You'll only get the alerts you picked.",
        dedupeKey: `test-${Date.now()}`,
      },
    );
    return { status };
  });

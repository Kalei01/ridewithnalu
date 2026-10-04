import { problemFingerprint, areaName } from "./problems";

type Rpc = (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;

/**
 * Record a problem in the Problems list and, the first time it shows up each
 * day, notify developer phones. Never throws.
 */
export async function recordProblem(source: "app" | "server", area: string, message: string) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rpc = supabaseAdmin.rpc.bind(supabaseAdmin) as unknown as Rpc;
    const { data: notify, error } = await rpc("record_app_problem", {
      p_fingerprint: problemFingerprint(source, area, message),
      p_source: source,
      p_area: area,
      p_message: message.slice(0, 300),
    });
    if (error || notify !== true) return;

    const { data: phones } = await rpc("developer_push_tokens");
    const { sendToSubscription } = await import("./push.server");
    const day = new Date().toISOString().slice(0, 10);
    for (const phone of (phones as Array<{
      token: string;
      categories: string[];
      quiet_start_min: number | null;
      quiet_end_min: number | null;
    }> | null) ?? []) {
      await sendToSubscription(
        { ...phone, categories: [...phone.categories, "urgent_fare_alerts"] },
        {
          category: "urgent_fare_alerts",
          title: `Nalu problem: ${areaName(area)}`,
          body: `${message.slice(0, 120)} · Open the Dev panel for details.`,
          dedupeKey: `problem-${problemFingerprint(source, area, message).slice(0, 80)}-${day}`,
          path: "/",
        },
      );
    }
  } catch {
    /* the Problems list must never break the request that failed */
  }
}

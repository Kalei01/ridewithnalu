import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

const schema = z.object({
  category: z.enum(["morning_commute", "major_traffic", "transit_disruption", "stop_transfer"]),
  title: z.string().min(1).max(80),
  body: z.string().min(1).max(240),
  dedupeKey: z.string().min(1).max(200),
  path: z.string().startsWith("/").max(200).optional(),
});

/** Scheduled/admin broadcast to every device opted into a category. */
export const Route = createFileRoute("/api/public/push-dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        let payload: z.infer<typeof schema>;
        try {
          payload = schema.parse(await request.json());
        } catch {
          return Response.json({ error: "Invalid payload" }, { status: 400 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendToSubscription } = await import("@/lib/push.server");
        const { data: subs, error } = await supabaseAdmin
          .from("push_subscriptions")
          .select("token, categories, quiet_start_min, quiet_end_min")
          .contains("categories", [payload.category]);
        if (error) return Response.json({ error: "Lookup failed" }, { status: 500 });
        const counts = { sent: 0, skipped: 0, removed: 0, failed: 0 };
        for (const sub of subs ?? []) {
          counts[await sendToSubscription(sub, payload)] += 1;
        }
        // Keep the dedupe ledger small.
        await supabaseAdmin
          .from("push_deliveries")
          .delete()
          .lt("sent_at", new Date(Date.now() - 7 * 86400_000).toISOString());
        return Response.json(counts);
      },
    },
  },
});

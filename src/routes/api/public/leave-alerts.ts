import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/** Every 5 minutes from pg_cron: send any "Time to leave" alerts that are due. */
export const Route = createFileRoute("/api/public/leave-alerts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const { runLeaveAlerts } = await import("@/lib/leave-alerts/run.server");
        try {
          return Response.json(await runLeaveAlerts());
        } catch (error) {
          console.error("[leave-alerts]", error instanceof Error ? error.message : error);
          return Response.json({ error: "Leave alerts failed" }, { status: 500 });
        }
      },
    },
  },
});

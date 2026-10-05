import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/** Sunday 6 p.m. Honolulu from pg_cron: send "Your week with Nalu". */
export const Route = createFileRoute("/api/public/weekly-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        try {
          const { sendWeeklyEmails } = await import("@/lib/email/weekly.server");
          return Response.json(await sendWeeklyEmails());
        } catch (error) {
          console.error("[weekly-email]", error instanceof Error ? error.message : error);
          const { reportServerError } = await import("@/lib/sentry-server");
          await reportServerError(error, "weekly-email");
          return Response.json({ error: "Weekly email failed" }, { status: 500 });
        }
      },
    },
  },
});

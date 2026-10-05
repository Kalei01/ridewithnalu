import { renderEmail, unsubscribeUrl, weekWithNaluEmail } from "./layout";
import { honoluluWeekStart } from "@/lib/trip-log";

type Rpc = (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
type Recipient = {
  user_id: string;
  email: string;
  unsub_token: string;
  trips: number;
  drive_trips: number;
  transit_trips: number;
  minutes_saved: number;
  average_minutes: number;
};

/** Stay under Resend's free daily limit, leaving room for sign-in emails. */
export const WEEKLY_BATCH = 80;

/** Sunday evening: send "Your week with Nalu" to riders who opted in and took a trip. */
export async function sendWeeklyEmails(now = Date.now()) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendEmail } = await import("./resend.server");
  const rpc = supabaseAdmin.rpc.bind(supabaseAdmin) as unknown as Rpc;
  const week = honoluluWeekStart(now).key;
  const { data, error } = await rpc("weekly_email_recipients", { p_week: week, p_limit: WEEKLY_BATCH });
  if (error) throw new Error("Couldn't load weekly email recipients.");
  const counts = { sent: 0, failed: 0 };
  for (const r of (data as Recipient[] | null) ?? []) {
    const unsub = unsubscribeUrl(r.unsub_token);
    const email = renderEmail(
      weekWithNaluEmail({
        trips: r.trips,
        driveTrips: r.drive_trips,
        transitTrips: r.transit_trips,
        minutesSaved: r.minutes_saved,
        averageMinutes: r.average_minutes,
      }),
      unsub,
    );
    const result = await sendEmail(r.email, email, unsub);
    if (result.ok) {
      await rpc("email_mark_weekly", { p_user: r.user_id, p_week: week });
      counts.sent += 1;
    } else {
      counts.failed += 1;
    }
  }
  if (counts.failed) {
    const { recordProblem } = await import("@/lib/problems.server");
    await recordProblem("server", "email", `Weekly email: ${counts.failed} failed to send`);
  }
  return { week, ...counts };
}

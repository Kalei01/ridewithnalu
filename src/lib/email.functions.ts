import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Rpc = (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
type PrefRow = { opted_in: boolean; unsub_token: string; welcome_sent_at: string | null };

async function adminRpc(): Promise<Rpc> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin.rpc.bind(supabaseAdmin) as unknown as Rpc;
}

function firstRow(data: unknown): PrefRow | null {
  return Array.isArray(data) && data.length ? (data[0] as PrefRow) : null;
}

function emailOf(claims: Record<string, unknown>): string | null {
  return typeof claims["email"] === "string" && claims["email"] ? claims["email"] : null;
}

/** Whether this rider gets Nalu emails, and whether they can (guests have no email). */
export const getEmailOptIn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = emailOf(context.claims as Record<string, unknown>);
    const rpc = await adminRpc();
    const { data } = await rpc("email_prefs_get", { p_user: context.userId });
    const row = firstRow(data);
    // chosen: they've answered yes or no before, so Nalu doesn't ask again.
    return { on: row?.opted_in ?? false, chosen: row !== null, email };
  });

/** Turn Nalu emails on or off. The first time on, send the welcome email. */
export const setEmailOptIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ on: z.boolean() }).parse(input))
  .handler(async ({ context, data }) => {
    const email = emailOf(context.claims as Record<string, unknown>);
    if (data.on && !email) return { on: false, welcomeSent: false, reason: "no-email" as const };
    const rpc = await adminRpc();
    const { data: rows, error } = await rpc("email_prefs_set", { p_user: context.userId, p_on: data.on });
    const row = firstRow(rows);
    if (error || !row) throw new Error("Couldn't save your email setting.");
    if (!data.on || row.welcome_sent_at || !email) return { on: row.opted_in, welcomeSent: false };

    const { renderEmail, unsubscribeUrl, welcomeEmail } = await import("./email/layout");
    const { sendEmail } = await import("./email/resend.server");
    const unsub = unsubscribeUrl(row.unsub_token);
    const sent = await sendEmail(email, renderEmail(welcomeEmail(), unsub), unsub);
    if (sent.ok) {
      await rpc("email_mark_welcome", { p_user: context.userId });
    } else {
      const { recordProblem } = await import("./problems.server");
      await recordProblem("server", "email", `Welcome email failed: ${sent.error}`);
    }
    return { on: row.opted_in, welcomeSent: sent.ok };
  });

const statsSchema = z.object({
  week: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  trips: z.number().int().min(0).max(500),
  driveTrips: z.number().int().min(0).max(500),
  transitTrips: z.number().int().min(0).max(500),
  minutesSaved: z.number().int().min(0).max(10000),
  averageMinutes: z.number().int().min(0).max(1440),
});

/**
 * The phone's weekly totals for the Sunday email. Numbers only, never places.
 * The database keeps them only if this rider turned emails on.
 */
export const saveWeeklyStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => statsSchema.parse(input))
  .handler(async ({ context, data }) => {
    const rpc = await adminRpc();
    const { data: saved } = await rpc("weekly_stats_save", {
      p_user: context.userId,
      p_week: data.week,
      p_trips: data.trips,
      p_drive: data.driveTrips,
      p_transit: data.transitTrips,
      p_saved: data.minutesSaved,
      p_average: data.averageMinutes,
    });
    return { saved: saved === true };
  });

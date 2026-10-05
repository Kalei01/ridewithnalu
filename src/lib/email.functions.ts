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
    return { on: firstRow(data)?.opted_in ?? false, email };
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

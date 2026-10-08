import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Rpc = (name: string) => Promise<{ data: unknown; error: unknown }>;

/** Throws unless the signed-in person is a developer (checked by the database). */
async function requireDeveloper(context: { supabase: { rpc: unknown } }) {
  const rpc = (context.supabase.rpc as (this: unknown, name: string) => ReturnType<Rpc>).bind(context.supabase) as Rpc;
  const { data } = await rpc("am_i_developer");
  if (data !== true) throw new Error("Developers only.");
}

/** Developer-only: send one test error from the server to Sentry and the Problems list. */
export const sendServerTestError = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireDeveloper(context);
    const { reportServerError } = await import("./sentry-server");
    await reportServerError(new Error("Nalu test error (server). Safe to clear."), "dev-test");
    return { ok: true };
  });

export type ProblemRow = {
  fingerprint: string;
  source: "app" | "server";
  area: string;
  message: string;
  count: number;
  first_seen: string;
  last_seen: string;
};

/** Developer-only: the most recent problems, newest first. */
export const listProblems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProblemRow[]> => {
    await requireDeveloper(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin.from as unknown as (t: string) => {
      select: (c: string) => { order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: ProblemRow[] | null }> } };
    }).call(supabaseAdmin, "app_problems")
      .select("fingerprint, source, area, message, count, first_seen, last_seen")
      .order("last_seen", { ascending: false })
      .limit(30);
    return data ?? [];
  });

/** Developer-only: clear one problem, or all of them. */
export const clearProblems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ fingerprint: z.string().max(200).optional() }).parse(input))
  .handler(async ({ context, data }) => {
    await requireDeveloper(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const table = (supabaseAdmin.from as unknown as (t: string) => {
      delete: () => { eq: (c: string, v: string) => Promise<unknown>; neq: (c: string, v: string) => Promise<unknown> };
    }).call(supabaseAdmin, "app_problems");
    if (data.fingerprint) await table.delete().eq("fingerprint", data.fingerprint);
    else await table.delete().neq("fingerprint", "");
    return { ok: true };
  });

/** Developer-only: link this phone's notifications so problem alerts reach it. */
export const linkDeveloperPhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ token: z.string().min(20).max(4096) }).parse(input))
  .handler(async ({ context, data }) => {
    await requireDeveloper(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("push_subscriptions").update({ user_id: context.userId }).eq("token", data.token);
    return { ok: true };
  });

export type UsageStats = {
  weekly_users: number;
  previous_week_users: number;
  today_users: number;
  weekly_signed_in: number;
  accounts: number;
  new_accounts_week: number;
  paying: number;
  /** Weekly users by the first link tag they arrived with; "direct" means no tag. */
  weekly_by_ref?: Record<string, number>;
};

/** Developer-only: weekly users, sign-ups and paying count. */
export const usageStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UsageStats | null> => {
    await requireDeveloper(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rpc = supabaseAdmin.rpc.bind(supabaseAdmin) as unknown as Rpc;
    const { data } = await rpc("usage_stats");
    return (data as UsageStats | null) ?? null;
  });

export type FunnelStats = {
  steps_week: Record<string, number>;
  steps_week_by_ref: Record<string, number>;
  new_phones_cohort: number;
  came_back_within_7_days: number;
  new_accounts_week: number;
};

/** Developer-only: the last 7 days of the anonymous visitor funnel. Null until migration 0064 is applied. */
export const funnelStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FunnelStats | null> => {
    await requireDeveloper(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rpc = supabaseAdmin.rpc.bind(supabaseAdmin) as unknown as Rpc;
    const { data, error } = await rpc("funnel_stats");
    return error ? null : ((data as FunnelStats | null) ?? null);
  });

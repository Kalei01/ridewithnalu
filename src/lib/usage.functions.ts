import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isAutomatedVisitor } from "@/lib/automated-visitor";

/** Counts this phone once for today (anonymous random id, no location), plus its first link tag. */
export const recordAppOpen = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        device: z.string().regex(/^[A-Za-z0-9-]{8,64}$/),
        tier: z.enum(["guest", "free", "plus"]),
        ref: z
          .string()
          .regex(/^[a-z0-9_-]{1,32}$/)
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    // Calls that don't come from a real browser (scripts, crawlers) aren't riders.
    const { getRequest } = await import("@tanstack/react-start/server");
    if (isAutomatedVisitor({ userAgent: getRequest().headers.get("user-agent") }))
      return { ok: true };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rpc = supabaseAdmin.rpc.bind(supabaseAdmin) as unknown as (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ error: unknown }>;
    await rpc("record_app_open", { p_device: data.device, p_tier: data.tier });
    // First channel this phone came from (e.g. ?ref=west); later tags never overwrite it.
    if (data.ref) await rpc("record_device_source", { p_device: data.device, p_ref: data.ref });
    return { ok: true };
  });

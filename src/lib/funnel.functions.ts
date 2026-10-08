import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isAutomatedVisitor } from "@/lib/automated-visitor";
import { FUNNEL_STEPS } from "@/lib/funnel-steps";

/**
 * Adds one to today's count for a visitor-funnel step. Nothing identifying is
 * sent or stored: just the step name and the visitor's first link tag.
 * If the database table isn't there yet this quietly does nothing.
 */
export const recordFunnelStep = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        step: z.enum(FUNNEL_STEPS),
        ref: z
          .string()
          .regex(/^[a-z0-9_-]{1,32}$/)
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    if (isAutomatedVisitor({ userAgent: getRequest().headers.get("user-agent") }))
      return { ok: true };
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const rpc = supabaseAdmin.rpc.bind(supabaseAdmin) as unknown as (
        name: string,
        args: Record<string, unknown>,
      ) => Promise<{ error: unknown }>;
      await rpc("record_funnel_step", { p_step: data.step, p_ref: data.ref ?? "" });
    } catch {
      /* counting must never get in a rider's way */
    }
    return { ok: true };
  });

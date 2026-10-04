import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Counts this phone once for today (anonymous random id, no location). */
export const recordAppOpen = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ device: z.string().regex(/^[A-Za-z0-9-]{8,64}$/), tier: z.enum(["guest", "free", "plus"]) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rpc = supabaseAdmin.rpc.bind(supabaseAdmin) as unknown as (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ error: unknown }>;
    await rpc("record_app_open", { p_device: data.device, p_tier: data.tier });
    return { ok: true };
  });

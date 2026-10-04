import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Developer-only: send one test error from the server to Sentry. */
export const sendServerTestError = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const rpc = context.supabase.rpc.bind(context.supabase) as unknown as (
      name: string,
    ) => Promise<{ data: unknown; error: unknown }>;
    const { data } = await rpc("am_i_developer");
    if (data !== true) throw new Error("Developers only.");
    const { reportServerError } = await import("./sentry-server");
    await reportServerError(new Error("Nalu test error (server). Safe to resolve."), "dev-test");
    return { ok: true };
  });

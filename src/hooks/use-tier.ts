import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { asTier, readPreviewTier, type Tier } from "@/lib/tiers";

// Called through the client object: a detached supabase.rpc loses its `this`
// and throws, which silently hid Developer mode and the plan check.
const rpc = (name: string) =>
  (supabase.rpc as unknown as (this: typeof supabase, fn: string) => Promise<{ data: unknown; error: unknown }>).call(
    supabase,
    name,
  );

/** Is the signed-in person a developer (owner account)? Checked by the database. */
export function useIsDeveloper(): boolean {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["am-i-developer", user?.id ?? "guest"],
    enabled: Boolean(user),
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data: dev, error } = await rpc("am_i_developer");
      if (error) throw error;
      return dev === true;
    },
  });
  return Boolean(user && data);
}

/** The person's real plan, from the database's my_tier(). */
export function useRealTier(): Tier {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["my-tier", user?.id ?? "guest"],
    enabled: Boolean(user),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: tier, error } = await rpc("my_tier");
      if (error) throw error;
      return asTier(tier);
    },
  });
  return user ? (data ?? "free") : "guest";
}

/**
 * The plan the app should behave as. Developers can preview another tier from
 * the Dev panel; everyone else always gets their real plan.
 */
export function useTier(): { tier: Tier; previewing: boolean } {
  const real = useRealTier();
  const developer = useIsDeveloper();
  const [preview, setPreview] = useState<Tier | null>(null);
  useEffect(() => {
    const sync = () => setPreview(readPreviewTier());
    sync();
    window.addEventListener("nalu-preview-tier", sync);
    return () => window.removeEventListener("nalu-preview-tier", sync);
  }, []);
  return developer && preview ? { tier: preview, previewing: true } : { tier: real, previewing: false };
}

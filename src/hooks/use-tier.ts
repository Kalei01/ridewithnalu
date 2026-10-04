import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { asTier, type Tier } from "@/lib/tiers";

/** The signed-in person's plan, from the database's my_tier(). */
export function useTier(): Tier {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["my-tier", user?.id ?? "guest"],
    enabled: Boolean(user),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: tier, error } = await (supabase.rpc as unknown as (
        name: string,
      ) => Promise<{ data: unknown; error: unknown }>)("my_tier");
      if (error) throw error;
      return asTier(tier);
    },
  });
  return user ? (data ?? "free") : "guest";
}

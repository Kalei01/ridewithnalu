import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { authStateAfterEvent, initialAuthState } from "@/lib/auth-state";

type AuthContextValue = { user: User | null; loading: boolean; signedInAt: number | null };

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signedInAt: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [{ user, loading, signedInAt }, setAuth] = useState(initialAuthState);

  useEffect(() => {
    let active = true;
    // Supabase emits INITIAL_SESSION from its persistent storage, then refreshes
    // tokens as needed. A second network lookup can race with sign-in/sign-out.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      setAuth((state) => authStateAfterEvent(state, event, session?.user ?? null, Date.now()));
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({ user, loading, signedInAt }), [user, loading, signedInAt]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

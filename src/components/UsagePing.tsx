import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useRealTier } from "@/hooks/use-tier";
import { debugDeviceId } from "@/lib/debug-log";
import { honoluluDateKey } from "@/lib/commute-formatting";
import { recordAppOpen } from "@/lib/usage.functions";
import { captureRef } from "@/lib/ref-source";

const KEY = "nalu-counted-day-v1";
/** Set once an owner signs in on this phone, so it's never counted again. */
const OWNER_KEY = "nalu-owner-device-v1";

function ownerPhone() {
  try {
    return window.localStorage.getItem(OWNER_KEY) === "1";
  } catch {
    return false;
  }
}

/** Counts this phone once a day for the private weekly-users number. */
export function UsagePing() {
  const tier = useRealTier();
  const { user } = useAuth();
  const record = useServerFn(recordAppOpen);
  // Owners' phones (the comped accounts) are left out of the counts.
  useEffect(() => {
    if (!user) return;
    void (supabase.rpc as unknown as (this: unknown, fn: string) => Promise<{ data: unknown }>)
      .call(supabase, "am_i_owner")
      .then(({ data }) => {
        if (data === true) window.localStorage.setItem(OWNER_KEY, "1");
      })
      .catch(() => undefined);
  }, [user?.id]);
  useEffect(() => {
    // Remember the link tag right away, before the URL changes.
    const ref = captureRef();
    const day = honoluluDateKey(new Date());
    let counted: string | null = null;
    try {
      counted = window.localStorage.getItem(KEY);
    } catch {
      /* private mode */
    }
    if (counted === `${day}|${tier}`) return;
    const timer = window.setTimeout(() => {
      if (ownerPhone()) return;
      void record({ data: { device: debugDeviceId(), tier, ...(ref ? { ref } : {}) } })
        .then(() => {
          try {
            window.localStorage.setItem(KEY, `${day}|${tier}`);
          } catch {
            /* private mode */
          }
        })
        .catch(() => undefined);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [tier]);
  return null;
}

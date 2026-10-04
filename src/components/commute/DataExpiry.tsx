import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const EXPIRY_DISMISS_KEY = "nalu-expiry-dismissed-v1";

type ExpiryData = {
  expiresOn: string;
  daysRemaining: number;
};

/** The expiry date is read from the loaded feed's calendar, never hardcoded. */
export function useDataExpiry() {
  const { data } = useQuery({
    queryKey: ["gtfs-expiry"],
    staleTime: 12 * 60 * 60_000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("gtfs_data_expiry");
      if (error) throw error;
      const row = (data ?? [])[0];
      return row
        ? { expiresOn: row.expires_on as string, daysRemaining: row.days_remaining as number }
        : null;
    },
  });
  return (data ?? null) as ExpiryData | null;
}

export function expiryLabel(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year!, (month ?? 1) - 1, day ?? 1).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function DataExpiryNotice() {
  const expiry = useDataExpiry();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!expiry) return;
    setDismissed(window.localStorage.getItem(EXPIRY_DISMISS_KEY) === expiry.expiresOn);
  }, [expiry]);

  if (!expiry) return null;
  const expired = expiry.daysRemaining < 0;
  if (!expired && (expiry.daysRemaining > 7 || dismissed)) return null;

  return (
    <div
      className={`mt-4 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-xs ${
        expired ? "border-destructive/40 text-destructive" : "border-chart-4/40 text-chart-4"
      }`}
      role="status"
    >
      <p>
        {expired
          ? "Transit data is out of date · times may be off"
          : "Bus and Skyline times are getting old · times may be off"}
      </p>
      {!expired && (
        <button
          type="button"
          aria-label="Dismiss schedule expiry notice"
          className="shrink-0 text-muted-foreground"
          onClick={() => {
            window.localStorage.setItem(EXPIRY_DISMISS_KEY, expiry.expiresOn);
            setDismissed(true);
          }}
        >
          Dismiss
        </button>
      )}
    </div>
  );
}

export function SettingsExpiryBanner() {
  const expiry = useDataExpiry();
  if (!expiry || expiry.daysRemaining > 14) return null;
  return (
    <p
      className="mb-4 rounded-lg border border-chart-4/40 px-4 py-3 text-xs text-chart-4"
      role="status"
    >
      Transit data expires {expiryLabel(expiry.expiresOn)} · refresh needed
    </p>
  );
}

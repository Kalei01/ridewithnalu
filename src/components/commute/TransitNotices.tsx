import { HOLO_FARES } from "@/lib/fares";
import { landmarkFor } from "@/lib/landmarks";

/** Subtle landmark line under a data-derived stop or station name. */
export function LandmarkHint({ name }: { name: string | null | undefined }) {
  const landmark = landmarkFor(name);
  if (!landmark) return null;
  return (
    <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground" title={landmark}>
      {landmark}
    </p>
  );
}

/**
 * Compact, expandable HOLO fare & payment note for transit itineraries.
 * Kept collapsed by default so regular riders are not bothered.
 */
export function FareNotice() {
  return (
    <details className="mt-1 rounded-md border border-border/60 bg-white/[0.02]">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-2.5 py-2 text-[11px] font-semibold text-muted-foreground [&::-webkit-details-marker]:hidden">
        <span className="rounded-sm bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">HOLO</span>
        Fares &amp; payment
      </summary>
      <div className="space-y-1.5 border-t border-border/60 px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground">
        <p>
          Single ride {HOLO_FARES.singleRide} with a HOLO card — includes free transfers between
          TheBus and Skyline within {HOLO_FARES.transferWindowHours} hours.
        </p>
        <p>
          Skyline requires a HOLO card (sold at station ticket machines). Cash ({HOLO_FARES.cashFare} on
          TheBus) has no transfers and is not accepted at Skyline gates.
        </p>
        <p>
          Daily cap: {HOLO_FARES.dailyCap} ({HOLO_FARES.seniorDailyCap} for Kūpuna 65+ with a Senior HOLO card).
        </p>
      </div>
    </details>
  );
}

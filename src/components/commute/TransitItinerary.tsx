import type { ReactNode } from "react";

type TransitItineraryProps = {
  transitLabel: string;
  itineraryRange: { low: number; high: number } | null;
  content: ReactNode;
  emptyMessage: string;
};

export function TransitItinerary({
  transitLabel,
  itineraryRange,
  content,
  emptyMessage,
}: TransitItineraryProps) {
  return (
    <div className="mt-6">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xl font-bold text-foreground">{transitLabel} itinerary</h3>
        {itineraryRange && (
          <p className="text-sm font-semibold text-muted-foreground">
            {itineraryRange.low}–{itineraryRange.high} min
          </p>
        )}
      </div>
      {content ?? (
        <p className="mt-5 text-sm text-muted-foreground">{emptyMessage}</p>
      )}
    </div>
  );
}

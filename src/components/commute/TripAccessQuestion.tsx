import { Bus, Car } from "lucide-react";
import { TRIP_ACCESS_OPTIONS, type TripAccess } from "@/lib/trip-access";

/**
 * Asked once per trip, after the destination is chosen and before any result.
 * The answer says what Nalu may consider (a car, or no car); it is not a choice
 * of route. Nalu still compares every itinerary that answer allows.
 *
 * Plain buttons with ring styles: the theme restyles `button.border` and glass
 * panels, which would hide the pressed state.
 */
export function TripAccessQuestion({
  destination,
  current = null,
  onChoose,
  onBack,
}: {
  destination: string;
  /** The answer being changed, so it shows as the current one. */
  current?: TripAccess | null;
  onChoose: (access: TripAccess) => void;
  /** A way out without answering: back to Browse. */
  onBack: () => void;
}) {
  return (
    <section
      className="verdict-lift glass-panel -mx-2 mt-5 rounded-2xl px-5 py-7 animate-in fade-in duration-300"
      aria-labelledby="trip-access-title"
    >
      <p className="text-xs font-semibold text-muted-foreground">To {destination}</p>
      <h1
        id="trip-access-title"
        className="mt-2 max-w-[390px] text-3xl font-bold leading-tight text-foreground"
      >
        How should Nalu plan your trip?
      </h1>
      <p className="mt-3 max-w-[390px] text-sm leading-6 text-muted-foreground">
        Nalu will compare Drive, Skyline, Bus, and combinations to find your best option.
      </p>
      <div role="group" aria-labelledby="trip-access-title" className="mt-6 grid gap-3">
        {TRIP_ACCESS_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChoose(option.value)}
            aria-pressed={current === option.value}
            className={`flex min-h-16 w-full items-center gap-4 rounded-2xl px-5 py-4 text-left text-lg font-bold text-foreground transition duration-[120ms] ease-out focus-visible:ring-2 focus-visible:ring-recommended active:scale-[0.99] active:bg-recommended/20 active:ring-2 active:ring-recommended ${
              current === option.value
                ? "bg-recommended/10 ring-2 ring-recommended"
                : "bg-background/40 ring-1 ring-border"
            }`}
          >
            {option.value === "vehicle" ? (
              <Car aria-hidden="true" className="size-7 shrink-0 text-recommended" />
            ) : (
              <Bus aria-hidden="true" className="size-7 shrink-0 text-recommended" />
            )}
            {/* Non-breaking hyphen so "drop-off" never wraps as "drop-" / "off". */}
            <span>{option.label.replace("drop-off", "drop\u2011off")}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onBack}
        className="mt-5 min-h-11 w-full text-center text-sm font-semibold text-muted-foreground underline underline-offset-4"
      >
        Back to Browse
      </button>
    </section>
  );
}

import { Bus, Car, TrainFront } from "lucide-react";

export type TripChoiceKey = "drive" | "skyline" | "bus";

export type TripChoice = {
  key: TripChoiceKey;
  /** "Drive", "Skyline", "Bus". */
  title: string;
  /** A few words on how: "Drive to UH West Oʻahu → Skyline → Bus 42", "Dropped off at Hālawa → Skyline". */
  steps: string | null;
  /** Leaving now: minutes from now to arrival. Arrive By: trip length. */
  minutes: number | null;
  /** "Arrive 8:11 AM", or "Leave 6:29 AM" when planning an arrival. */
  timeLabel: string | null;
  /** Arrive By only: this way doesn't get there in time. */
  late?: boolean;
  status: "ready" | "loading" | "empty";
  /** Shown instead of minutes when there's no trip: "No bus trip right now", "Can't check right now". */
  emptyText?: string;
  /** A short factual caveat, e.g. the lot that often fills. */
  note?: string | null;
  pick: boolean;
  locked: boolean;
};

const ICONS = { drive: Car, skyline: TrainFront, bus: Bus } as const;

/**
 * The ways to make this trip, side by side: drive, Skyline, and bus.
 * Lives inside the verdict card so the headline's math is on screen. Nalu's
 * pick is marked; tapping a row shows that trip's details below. Everyone sees
 * every choice, so a rider without a car today just uses the Bus row.
 *
 * Plain <button>s with their own ring styles: the theme restyles
 * button.border and glass panels, which would hide the selected state.
 */
export function TripChoiceCards({
  choices,
  selectedKey,
  commitment,
  formatMinutes,
  onSelect,
  access,
}: {
  choices: TripChoice[];
  /** Null while Nalu is still deciding: no row is marked until there's an answer. */
  selectedKey: TripChoiceKey | null;
  commitment: boolean;
  formatMinutes: (minutes: number) => string;
  onSelect: (key: TripChoiceKey) => void;
  /** What the rider said works for this trip, with a way to change it. */
  access?: { label: string; onChange: () => void } | null;
}) {
  return (
    <div role="radiogroup" aria-label="Ways to make this trip" className="mt-4 grid gap-2">
      {access && !commitment && (
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-muted-foreground">
          <span>Based on: {access.label}</span>
          <button
            type="button"
            onClick={access.onChange}
            className="min-h-11 px-1 font-semibold text-primary underline underline-offset-4"
          >
            Change
          </button>
        </p>
      )}
      {choices.map((choice) => {
        const Icon = ICONS[choice.key];
        const unavailable = choice.status !== "ready";
        // A row still checking (or with no trip) is never shown as selected.
        const selected = selectedKey === choice.key && !unavailable;
        // Each row's answer fades in as it arrives (opacity only; none with reduced
        // motion). Keyed on status, so a later ETA update changes in place.
        const valueIn = choice.status === "loading" ? undefined : "nalu-value-in";
        const dimmed = commitment && !choice.locked;
        return (
          <button
            key={choice.key}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={commitment || unavailable}
            onClick={() => onSelect(choice.key)}
            className={`w-full min-w-0 rounded-xl p-3 text-left ring-1 transition-colors ${
              selected
                ? "bg-recommended/10 ring-2 ring-recommended"
                : "bg-background/40 ring-border"
            } ${dimmed ? "opacity-40" : ""} ${unavailable && !commitment ? "cursor-default" : ""}`}
          >
            {/* Title and minutes, then badge and time, then the steps across
                the full width so a narrow phone doesn't squeeze them. */}
            <span className="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1">
              <Icon
                aria-hidden="true"
                className={`size-5 shrink-0 self-center ${selected ? "text-recommended" : "text-muted-foreground"}`}
              />
              <span className="min-w-0 truncate text-base font-bold text-foreground">
                {choice.title}
              </span>
              <span className="whitespace-nowrap text-right text-base font-bold tabular-nums text-foreground">
                <span key={choice.status} className={valueIn}>
                  {choice.status === "loading"
                    ? "Checking…"
                    : choice.status === "empty"
                      ? ""
                      : choice.minutes !== null
                        ? formatMinutes(choice.minutes)
                        : "—"}
                </span>
              </span>
              <span aria-hidden="true" />
              <span className="min-w-0">
                {choice.locked ? (
                  <span className="nalu-value-in whitespace-nowrap rounded-full bg-recommended px-2 py-0.5 text-xs font-bold text-recommended-foreground">
                    On this trip
                  </span>
                ) : choice.pick && !commitment ? (
                  <span className="nalu-value-in whitespace-nowrap rounded-full bg-recommended px-2 py-0.5 text-xs font-bold text-recommended-foreground">
                    Nalu’s pick
                  </span>
                ) : null}
              </span>
              <span
                className={`whitespace-nowrap text-right text-sm tabular-nums ${
                  choice.late ? "font-semibold text-warning" : "text-muted-foreground"
                }`}
              >
                {choice.status === "ready" ? (
                  <span className={valueIn}>{choice.late ? "Too late" : choice.timeLabel}</span>
                ) : null}
              </span>
              <span className="col-span-2 col-start-2 min-w-0 break-words text-sm text-muted-foreground">
                <span key={choice.status} className={valueIn}>
                  {choice.status === "empty" ? choice.emptyText : choice.steps}
                </span>
              </span>
              {choice.note && choice.status === "ready" && (
                <span className="col-span-2 col-start-2 mt-1 block break-words text-sm text-foreground/85">
                  {choice.note}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

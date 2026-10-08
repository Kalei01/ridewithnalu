import { Clock, Navigation } from "lucide-react";
import { markWelcomeSeen } from "@/lib/welcome-seen";
import type { GuideDestination } from "./destinations";

/**
 * "Try this trip": a plain GET form (works before any script loads) that opens
 * the planner on this guide's destination, already set to Leave now or to
 * Arrive by a time. The planner reads `to`, `name`, `when` and `time`.
 */
export function TryTripPanel({ destination }: { destination: GuideDestination }) {
  const option =
    "flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-background/60 px-3 text-base font-semibold text-foreground transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/12 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary";
  return (
    <section
      aria-labelledby="try-trip"
      className="group rounded-2xl border border-border bg-card/60 p-5 sm:p-6"
    >
      <h2 id="try-trip" className="text-xl font-bold">
        Try this trip
      </h2>
      <p className="mt-1 text-base leading-7 text-muted-foreground">
        Pick when, and Nalu opens with {destination.name} ready to check.
      </p>
      <form method="get" action="/" onSubmit={markWelcomeSeen} className="mt-4 grid gap-3">
        <input type="hidden" name="to" value={`${destination.lat},${destination.lon}`} />
        <input type="hidden" name="name" value={destination.name} />
        <input type="hidden" name="ref" value="guide" />
        <fieldset className="flex gap-3">
          <legend className="sr-only">When</legend>
          <label className={option}>
            <input type="radio" name="when" value="now" defaultChecked className="sr-only" />
            <Navigation className="size-5" aria-hidden="true" />
            Leave now
          </label>
          <label className={option}>
            <input type="radio" name="when" value="arrive" className="sr-only" />
            <Clock className="size-5" aria-hidden="true" />
            Arrive by
          </label>
        </fieldset>
        <label className="hidden items-center gap-3 text-base text-foreground group-has-[input[value=arrive]:checked]:flex">
          <span className="font-semibold">Be there by</span>
          <input
            type="time"
            name="time"
            defaultValue="08:00"
            className="min-h-12 flex-1 rounded-xl border border-border bg-background/60 px-3 text-base"
          />
        </label>
        <button
          type="submit"
          className="liquid-primary-action inline-flex min-h-14 items-center justify-center rounded-2xl px-6 text-center text-base font-bold"
        >
          Check this trip
        </button>
      </form>
    </section>
  );
}

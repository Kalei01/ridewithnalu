import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BellRing, Car, Moon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ensurePushSignup } from "@/components/LeaveAlertCard";
import { clockFromSeconds } from "@/lib/commute-formatting";
import { scheduleLastBusReminder } from "@/lib/leave-alerts.functions";
import { nightStatus, rideshareLinks, type NightOption } from "@/lib/night/night-status";
import { savePushSubscription } from "@/lib/push.functions";

type Leg = {
  mode: string;
  route_short?: string | null;
  from?: string | null;
  depart_seconds: number | null;
};
type Option = NightOption & { legs: Leg[] };

const REMIND_BEFORE_SECONDS = 15 * 60;

function titleCase(value: string) {
  return value.toLowerCase().replace(/\b([a-z])/g, (letter) => letter.toUpperCase());
}

/** "Route 2 at 11:42 PM from Kapiolani Blvd + Ward Ave", from the trip's first ride. */
function firstRide(option: Option) {
  const ride = option.legs.find((leg) => leg.mode === "bus" || leg.mode === "rail");
  if (!ride) return null;
  const name = ride.mode === "rail" ? "Skyline" : ride.route_short?.trim() ? `Route ${ride.route_short.trim()}` : "the bus";
  const at = ride.depart_seconds !== null ? ` at ${clockFromSeconds(ride.depart_seconds)}` : "";
  const from = ride.from ? ` from ${titleCase(ride.from)}` : "";
  return `${name}${at}${from}`;
}

/**
 * Night mode (about 9 PM to 5 AM): leads with what matters late at night.
 * The last trip tonight with a one-tap reminder, or "no more buses tonight"
 * with Uber and Lyft to this trip's own destination.
 */
export function NightCard({
  nowSeconds,
  options,
  plannerAnswered,
  destination,
}: {
  nowSeconds: number;
  options: Option[];
  plannerAnswered: boolean;
  destination: { lat: number; lon: number; name: string } | null;
}) {
  const [busy, setBusy] = useState(false);
  const [reminded, setReminded] = useState(false);
  const saveSub = useServerFn(savePushSubscription);
  const schedule = useServerFn(scheduleLastBusReminder);
  const status = nightStatus(nowSeconds, options, plannerAnswered);
  if (status.kind === "day") return null;

  const links = destination ? rideshareLinks(destination) : null;
  const rideshare = links && (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <a
        href={links.uber}
        className="flex h-12 items-center justify-center gap-2 rounded-lg border border-border bg-background/60 text-base font-semibold text-foreground"
      >
        <Car className="size-4" /> Uber
      </a>
      <a
        href={links.lyft}
        className="flex h-12 items-center justify-center gap-2 rounded-lg border border-border bg-background/60 text-base font-semibold text-foreground"
      >
        <Car className="size-4" /> Lyft
      </a>
    </div>
  );

  if (status.kind === "none_tonight") {
    const first = status.first as Option | null;
    return (
      <section className="mt-4 rounded-2xl border border-warning/40 bg-warning/10 p-4" aria-label="Night service">
        <p className="flex items-center gap-2 text-lg font-bold text-foreground">
          <Moon className="size-5 text-warning" /> No more buses or Skyline tonight
        </p>
        <p className="mt-1 text-base leading-7 text-muted-foreground">
          {first
            ? `The first trip leaves at ${clockFromSeconds(first.leave_by_seconds ?? first.depart_seconds)}${firstRide(first) ? ` (${firstRide(first)})` : ""}.`
            : "Nalu didn't find a bus or train for this trip until morning."}
          {links ? " To go now, a ride opens with this destination filled in:" : ""}
        </p>
        {rideshare}
        <p className="mt-2 text-xs text-muted-foreground">Nalu can't see Uber or Lyft prices or wait times.</p>
      </section>
    );
  }

  const option = status.option as Option;
  const ride = firstRide(option);
  const leaveBy = status.leaveBy;
  const secondsLeft = leaveBy - nowSeconds;
  const canRemind = secondsLeft > REMIND_BEFORE_SECONDS + 60;

  async function remind() {
    if (busy) return;
    setBusy(true);
    try {
      const token = await ensurePushSignup(saveSub);
      if (!token) return;
      const sendAt = new Date(Date.now() + (leaveBy - REMIND_BEFORE_SECONDS - nowSeconds) * 1000);
      await schedule({
        data: {
          token,
          sendAt: sendAt.toISOString(),
          title: "Last bus tonight: leave in 15 minutes",
          body: `Leave by ${clockFromSeconds(leaveBy)}${ride ? ` for ${ride}` : ""}. It's the last one tonight (scheduled time).`,
        },
      });
      setReminded(true);
      toast.success(`Reminder set for ${clockFromSeconds(leaveBy - REMIND_BEFORE_SECONDS)}.`);
    } catch {
      toast.error("Couldn't set the reminder. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-4 rounded-2xl border border-primary/40 bg-primary/10 p-4" aria-label="Last trip tonight">
      <p className="flex items-center gap-2 text-lg font-bold text-foreground">
        <Moon className="size-5 text-primary" /> Last trip tonight: leave by {clockFromSeconds(leaveBy)}
      </p>
      <p className="mt-1 text-base leading-7 text-muted-foreground">
        {ride ? `${ride}. ` : ""}After this, nothing runs until morning.
      </p>
      {canRemind && !reminded && (
        <Button type="button" className="mt-3 h-12 w-full gap-2 text-base" disabled={busy} onClick={() => void remind()}>
          <BellRing className="size-4" /> Remind me 15 min before
        </Button>
      )}
      {reminded && (
        <p className="mt-3 text-sm font-semibold text-primary">
          Reminder set for {clockFromSeconds(leaveBy - REMIND_BEFORE_SECONDS)}.
        </p>
      )}
    </section>
  );
}

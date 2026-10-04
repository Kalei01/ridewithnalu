import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BellRing, Share, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { removeLeaveAlert, saveLeaveAlert } from "@/lib/leave-alerts.functions";
import {
  DAY_LETTERS,
  DAY_NAMES,
  LEAVE_OFFER_DISMISSED_KEY,
  WEEKDAYS,
  describeDays,
  minutesClock,
  readLeaveAlerts,
  writeLeaveAlerts,
  type LocalLeaveAlert,
} from "@/lib/leave-alerts-client";
import { clockToMinutes, obtainPushToken, readPushPrefs, writePushPrefs } from "@/lib/push-client";
import { savePushSubscription } from "@/lib/push.functions";
import { findByKind, type SavedPlace } from "@/lib/places/saved-places";

const BLOCKED_COPY = {
  "not-configured": "Notifications aren't set up yet.",
  unsupported: "This browser can't show notifications. On iPhone, add Nalu to your Home Screen first.",
  "open-in-new-tab": "Open Nalu in its own tab or the installed app to turn on alerts.",
  denied: "Notifications are blocked for Nalu. Allow them in your phone's settings, then try again.",
} as const;

/** One trip an alert can cover: the morning trip out, or the trip home. */
type Trip = {
  placeKey: string;
  label: string;
  toHome: boolean;
  from: SavedPlace;
  to: SavedPlace;
  defaultTime: string;
  heading: string;
};

function isInstalled() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
function isIos() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);
}
function readDismissed() {
  try {
    return window.localStorage.getItem(LEAVE_OFFER_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}
function timeInput(seconds: number | null | undefined, fallback: string) {
  if (typeof seconds !== "number") return fallback;
  const minutes = Math.round(seconds / 60) % 1440;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function tripsFor(places: SavedPlace[]): Trip[] {
  const home = findByKind(places, "home");
  const away = findByKind(places, "work") ?? places.find((place) => place.kind !== "home") ?? null;
  if (!home || !away) return [];
  return [
    {
      placeKey: `${away.kind}:${away.id}`,
      label: away.label,
      toHome: false,
      from: home,
      to: away,
      defaultTime: timeInput(away.typicalArrivalSeconds, "08:00"),
      heading: `Know when to leave for ${away.label}`,
    },
    {
      placeKey: `home-from:${away.id}`,
      label: "Home",
      toHome: true,
      from: away,
      to: home,
      defaultTime: timeInput(home.typicalArrivalSeconds, "17:30"),
      heading: `Know when to leave ${away.label} for home`,
    },
  ];
}

/** Time + days + "Turn on alert" for one trip. */
function TripSetup({
  trip,
  busy,
  onTurnOn,
}: {
  trip: Trip;
  busy: boolean;
  onTurnOn: (trip: Trip, arriveMin: number, days: number[]) => void;
}) {
  const [time, setTime] = useState(trip.defaultTime);
  const [days, setDays] = useState<number[]>(WEEKDAYS);
  useEffect(() => setTime(trip.defaultTime), [trip.defaultTime]);

  return (
    <div className="grid gap-3">
      <label className="grid gap-1 text-sm font-medium text-foreground">
        Be {trip.toHome ? "home" : `at ${trip.label}`} by
        <Input
          type="time"
          value={time}
          onChange={(event) => setTime(event.target.value)}
          className="h-12 max-w-40 bg-background text-base"
        />
      </label>
      <div role="group" aria-label="Days" className="flex flex-wrap gap-1.5">
        {[1, 2, 3, 4, 5, 6, 7].map((day) => {
          const on = days.includes(day);
          return (
            <button
              key={day}
              type="button"
              aria-pressed={on}
              aria-label={DAY_NAMES[day]}
              onClick={() =>
                setDays((current) =>
                  on ? current.filter((value) => value !== day) : [...current, day].sort(),
                )
              }
              className={`size-11 rounded-full text-sm font-bold ${on ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}
            >
              {DAY_LETTERS[day]}
            </button>
          );
        })}
      </div>
      <Button
        type="button"
        onClick={() => {
          const arriveMin = clockToMinutes(time);
          if (arriveMin !== null && days.length) onTurnOn(trip, arriveMin, days);
        }}
        disabled={busy || days.length === 0}
        className="h-12 text-base"
      >
        Turn on alert
      </Button>
    </div>
  );
}

/**
 * "Time to leave" alerts. The `offer` variant is the card on the home screen
 * (the trip out first, then once that's on, the trip home); `settings` lists
 * alerts and sets either trip up.
 */
export function LeaveAlertCard({
  places,
  variant,
}: {
  places: SavedPlace[];
  variant: "offer" | "settings";
}) {
  const [ready, setReady] = useState(false);
  const [alerts, setAlerts] = useState<LocalLeaveAlert[]>([]);
  const [dismissed, setDismissed] = useState(true);
  const [needsInstall, setNeedsInstall] = useState(false);
  const [busy, setBusy] = useState(false);
  const saveSub = useServerFn(savePushSubscription);
  const saveAlert = useServerFn(saveLeaveAlert);
  const removeAlert = useServerFn(removeLeaveAlert);

  useEffect(() => {
    setAlerts(readLeaveAlerts());
    setDismissed(readDismissed());
    setNeedsInstall(isIos() && !isInstalled());
    setReady(true);
  }, []);

  const trips = tripsFor(places);
  const isOn = (trip: Trip) => alerts.some((alert) => alert.placeKey === trip.placeKey);
  const openTrips = trips.filter((trip) => !isOn(trip));

  if (!ready) return null;

  async function turnOn(trip: Trip, arriveMin: number, days: number[]) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await obtainPushToken(true);
      if (result.status !== "registered") {
        toast(BLOCKED_COPY[result.status]);
        return;
      }
      const prefs = readPushPrefs();
      const categories = Array.from(new Set([...prefs.categories, "morning_commute" as const]));
      await saveSub({
        data: {
          token: result.token,
          ...(prefs.token && prefs.token !== result.token ? { previousToken: prefs.token } : {}),
          categories,
          quietStartMin: clockToMinutes(prefs.quietStart),
          quietEndMin: clockToMinutes(prefs.quietEnd),
        },
      });
      writePushPrefs({ ...prefs, categories, token: result.token });
      await saveAlert({
        data: {
          token: result.token,
          placeKey: trip.placeKey,
          placeLabel: trip.label,
          toHome: trip.toHome,
          origin: { lat: trip.from.lat, lon: trip.from.lon },
          destination: { lat: trip.to.lat, lon: trip.to.lon },
          arriveMin,
          days,
        },
      });
      const next = [
        ...alerts.filter((alert) => alert.placeKey !== trip.placeKey),
        { placeKey: trip.placeKey, placeLabel: trip.label, arriveMin, days },
      ];
      writeLeaveAlerts(next);
      setAlerts(next);
      toast.success(
        `Alert on: ${describeDays(days)}, to be ${trip.toHome ? "home" : `at ${trip.label}`} by ${minutesClock(arriveMin)}.`,
      );
    } catch {
      toast.error("Couldn't turn on the alert. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff(alert: LocalLeaveAlert) {
    const token = readPushPrefs().token;
    setBusy(true);
    try {
      if (token) await removeAlert({ data: { token, placeKey: alert.placeKey } });
      const next = alerts.filter((item) => item.placeKey !== alert.placeKey);
      writeLeaveAlerts(next);
      setAlerts(next);
      toast(`Alert for ${alert.placeLabel} is off.`);
    } catch {
      toast.error("Couldn't turn the alert off. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    try {
      window.localStorage.setItem(LEAVE_OFFER_DISMISSED_KEY, "1");
    } catch {
      /* private mode */
    }
    setDismissed(true);
  }

  const installNote = (
    <p className="mt-2 text-sm leading-6 text-muted-foreground">
      On iPhone, alerts work once Nalu is on your Home Screen. Tap{" "}
      <Share className="mx-0.5 inline size-4 align-text-bottom text-foreground" aria-label="Share" /> in
      Safari, then <span className="font-semibold text-foreground">Add to Home Screen</span>, and open Nalu
      from there.
    </p>
  );

  if (variant === "offer") {
    const trip = openTrips[0];
    if (dismissed || !trip) return null;
    const followUp = trip.toHome && alerts.length > 0;
    return (
      <section
        aria-label="Time to leave alert"
        className="relative mt-4 rounded-lg border border-primary/30 bg-primary/10 p-4 pr-12"
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="No thanks"
          className="absolute right-1 top-1 flex size-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
        <p className="flex items-center gap-2 text-base font-semibold text-foreground">
          <BellRing className="size-4 text-primary" /> {followUp ? "Want one for the trip home too?" : trip.heading}
        </p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Nalu checks traffic and the bus and Skyline times, then sends one alert about 10 minutes
          before you need to go.
        </p>
        {needsInstall ? (
          installNote
        ) : (
          <div className="mt-3">
            <TripSetup trip={trip} busy={busy} onTurnOn={(t, a, d) => void turnOn(t, a, d)} />
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="grid gap-3">
      <div>
        <p className="text-sm font-semibold text-foreground">Time to leave</p>
        <p className="text-xs text-muted-foreground">
          One alert about 10 minutes before you need to go, based on live traffic and the timetable.
        </p>
      </div>
      {alerts.map((alert) => (
        <div key={alert.placeKey} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
          <p className="text-sm text-foreground">
            <span className="font-semibold">{alert.placeLabel}</span> by {minutesClock(alert.arriveMin)},{" "}
            {describeDays(alert.days)}
          </p>
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void turnOff(alert)}>
            Turn off
          </Button>
        </div>
      ))}
      {trips.length === 0 ? (
        <p className="text-sm text-muted-foreground">Save Home and Work first, then set up an alert here.</p>
      ) : needsInstall && openTrips.length ? (
        installNote
      ) : (
        openTrips.map((trip) => (
          <div key={trip.placeKey} className="rounded-lg border border-border p-3">
            <p className="mb-2 text-sm font-semibold text-foreground">
              {trip.toHome ? `Trip home from ${trip.from.label}` : `Trip to ${trip.label}`}
            </p>
            <TripSetup trip={trip} busy={busy} onTurnOn={(t, a, d) => void turnOn(t, a, d)} />
          </div>
        ))
      )}
    </div>
  );
}

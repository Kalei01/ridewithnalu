import { useEffect, useState } from "react";
import { useGate } from "@/hooks/use-gate";
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

type AlertTrip = {
  placeKey: string;
  label: string;
  toHome: boolean;
  from: { lat: number; lon: number };
  to: { lat: number; lon: number };
};

/**
 * Make sure this phone is signed up for notifications (asking if needed) and
 * return its token, or null with a friendly message when it can't be.
 */
export async function ensurePushSignup(
  saveSub: ReturnType<typeof useServerFn<typeof savePushSubscription>>,
): Promise<string | null> {
  const result = await obtainPushToken(true);
  if (result.status !== "registered") {
    toast(BLOCKED_COPY[result.status]);
    return null;
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
  return result.token;
}

/**
 * Sign this phone up for notifications if needed, then save one trip's alert.
 * Returns the device's alerts afterwards, or null when notifications are blocked.
 */
async function saveTripAlert(
  trip: AlertTrip,
  arriveMin: number,
  days: number[],
  saveSub: ReturnType<typeof useServerFn<typeof savePushSubscription>>,
  saveAlert: ReturnType<typeof useServerFn<typeof saveLeaveAlert>>,
): Promise<LocalLeaveAlert[] | null> {
  const token = await ensurePushSignup(saveSub);
  if (!token) return null;
  await saveAlert({
    data: {
      token,
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
    ...readLeaveAlerts().filter((alert) => alert.placeKey !== trip.placeKey),
    { placeKey: trip.placeKey, placeLabel: trip.label, arriveMin, days },
  ];
  writeLeaveAlerts(next);
  toast.success(
    `Alert on: ${describeDays(days)}, to be ${trip.toHome ? "home" : `at ${trip.label}`} by ${minutesClock(arriveMin)}.`,
  );
  return next;
}

/** The alert key for a destination: a saved place's own key, else its rounded spot. */
export function alertKeyFor(
  places: SavedPlace[],
  to: { lat: number; lon: number },
  toHome: boolean,
  from?: { lat: number; lon: number },
) {
  const near = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) =>
    Math.hypot((a.lat - b.lat) * 111_000, (a.lon - b.lon) * 104_000) < 200;
  if (toHome) {
    const away = from ? places.find((place) => place.kind !== "home" && near(place, from)) : null;
    return away ? `home-from:${away.id}` : `home-from:${from ? `${from.lat.toFixed(3)},${from.lon.toFixed(3)}` : "here"}`;
  }
  const saved = places.find((place) => place.kind !== "home" && near(place, to));
  return saved ? `${saved.kind}:${saved.id}` : `trip:${to.lat.toFixed(3)},${to.lon.toFixed(3)}`;
}

/**
 * "Remind me when to leave" on the trip screen: one tap opens the time and
 * days for THIS trip, then saves a Time-to-leave alert for it.
 */
export function RemindMeButton({
  trip,
  defaultTime,
}: {
  trip: AlertTrip;
  defaultTime: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState<LocalLeaveAlert | null>(null);
  const saveSub = useServerFn(savePushSubscription);
  const saveAlert = useServerFn(saveLeaveAlert);
  useEffect(() => {
    setExisting(readLeaveAlerts().find((alert) => alert.placeKey === trip.placeKey) ?? null);
  }, [trip.placeKey, open]);

  if (existing && !open) {
    return (
      <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
        <BellRing className="size-4 text-primary" />
        Leave alert on: {trip.toHome ? "home" : trip.label} by {minutesClock(existing.arriveMin)},{" "}
        {describeDays(existing.days)}
      </p>
    );
  }
  if (!open) {
    return (
      <Button type="button" variant="outline" className="mt-3 h-12 w-full gap-2 text-base" onClick={() => setOpen(true)}>
        <BellRing className="size-4" /> Remind me when to leave
      </Button>
    );
  }
  const setupTrip: Trip = {
    placeKey: trip.placeKey,
    label: trip.label,
    toHome: trip.toHome,
    from: trip.from as SavedPlace,
    to: trip.to as SavedPlace,
    defaultTime,
    heading: "",
  };
  return (
    <div className="mt-3 rounded-lg border border-border p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Remind me when to leave</p>
        <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="flex size-11 items-center justify-center text-muted-foreground">
          <X className="size-4" />
        </button>
      </div>
      <TripSetup
        trip={setupTrip}
        busy={busy}
        onTurnOn={(_, arriveMin, days) => {
          setBusy(true);
          void saveTripAlert(trip, arriveMin, days, saveSub, saveAlert)
            .then((next) => {
              if (next) setOpen(false);
            })
            .catch(() => toast.error("Couldn't turn on the alert. Try again."))
            .finally(() => setBusy(false));
        }}
      />
    </div>
  );
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
  centered = false,
}: {
  trip: Trip;
  busy: boolean;
  onTurnOn: (trip: Trip, arriveMin: number, days: number[]) => void;
  centered?: boolean;
}) {
  const [time, setTime] = useState(trip.defaultTime);
  const [days, setDays] = useState<number[]>(WEEKDAYS);
  const gate = useGate();
  useEffect(() => setTime(trip.defaultTime), [trip.defaultTime]);
  // Plans: a free account gets one leave alert; Plus gets alerts for every trip.
  function allowedByPlan() {
    if (!gate.require("leave_alert_one")) return false;
    const others = readLeaveAlerts().filter((alert) => alert.placeKey !== trip.placeKey).length;
    return others === 0 || gate.require("leave_alerts_all");
  }

  return (
    <div className="grid gap-4">
      <label className={`grid gap-1.5 text-sm font-medium text-muted-foreground ${centered ? "justify-items-center text-center" : ""}`}>
        Be {trip.toHome ? "home" : `at ${trip.label}`} by
        <Input
          type="time"
          value={time}
          onChange={(event) => setTime(event.target.value)}
          className={`h-14 bg-background text-xl font-semibold ${centered ? "w-full max-w-56 text-center" : "max-w-40"}`}
        />
      </label>
      {/* Seven equal columns keep the whole week on one row on any phone. */}
      <div role="group" aria-label="Days" className="grid grid-cols-7 gap-1">
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
              className={`aspect-square w-full max-w-12 !min-h-0 justify-self-center rounded-full text-sm font-bold ${on ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}
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
          if (arriveMin !== null && days.length && allowedByPlan()) onTurnOn(trip, arriveMin, days);
        }}
        disabled={busy || days.length === 0}
        className="h-12 w-full text-base"
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
      const next = await saveTripAlert(trip, arriveMin, days, saveSub, saveAlert);
      if (next) setAlerts(next);
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
        className="relative mt-4 rounded-2xl border border-primary/30 bg-primary/10 px-4 pb-5 pt-6 text-center"
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="No thanks"
          className="absolute right-1 top-1 flex size-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-primary/15 text-primary" aria-hidden="true">
          <BellRing className="size-5" />
        </span>
        <p className="mx-auto mt-3 max-w-xs px-6 text-lg font-semibold leading-snug text-foreground">
          {followUp ? "Want one for the trip home too?" : trip.heading}
        </p>
        <p className="mx-auto mt-1.5 max-w-xs text-sm leading-6 text-muted-foreground">
          One alert about 10 minutes before you need to go, based on live traffic and bus and Skyline times.
        </p>
        {needsInstall ? (
          installNote
        ) : (
          <div className="mt-5 text-left">
            <TripSetup trip={trip} busy={busy} centered onTurnOn={(t, a, d) => void turnOn(t, a, d)} />
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

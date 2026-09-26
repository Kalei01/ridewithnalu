/**
 * Pure logic for the automatic "approaching your stop" alert.
 *
 * Kept free of React and network access so it can be unit tested: given the
 * planned stop sequence, the clock and (optionally) recent GPS fixes, it decides
 * which alert state the rider should see, including the safety states for a
 * missed stop and for a vehicle that has left the planned corridor.
 */

export type ApproachCoords = { lat: number; lon: number };

export type ApproachStop = {
  stopName: string;
  lat: number | null;
  lon: number | null;
  arriveSeconds: number | null;
  isAlight: boolean;
};

export type ApproachState = "cruising" | "ready" | "urgent" | "passed" | "off-route";

export type ApproachInput = {
  stops: ApproachStop[];
  nowSeconds: number;
  /** Latest GPS fix, or null when location is unavailable or unusable. */
  rider: ApproachCoords | null;
  /** Recent distances (m) from rider to the alight stop, oldest first. */
  distanceTrend?: number[];
  /** State shown a moment ago, used to avoid flickering between states. */
  previousState?: ApproachState | null;
};

export type ApproachResult = {
  state: ApproachState;
  stopsAway: number;
  minutesToAlight: number | null;
  metersToAlight: number | null;
  nextStopName: string;
  alightName: string;
  /** True when the decision used GPS, false when it used the timetable. */
  live: boolean;
};

/** Beyond this, a fix is too far from every planned stop to trust as on-route. */
const OFF_ROUTE_M = 1500;
/** Beyond this, a fix is ignored and the timetable takes over. */
const GPS_USABLE_M = 3000;
/** Past the alight stop by more than this, with distance growing, means missed. */
const PASSED_M = 400;
/** Distance growth across recent fixes that counts as moving away. */
const MOVING_AWAY_M = 150;
/** Minutes past the scheduled arrival before a missed stop is assumed. */
const PASSED_GRACE_SEC = 180;

export function metersBetween(a: ApproachCoords, b: ApproachCoords) {
  const R = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function evaluateApproach(input: ApproachInput): ApproachResult | null {
  const { stops, nowSeconds, rider, distanceTrend = [], previousState = null } = input;
  if (stops.length < 2) return null;

  const alightIndex = stops.findIndex((stop) => stop.isAlight);
  const endIndex = alightIndex >= 0 ? alightIndex : stops.length - 1;
  const alight = stops[endIndex];
  if (!alight) return null;

  const nearest = rider
    ? stops
        .map((stop, index) => ({
          index,
          distance:
            stop.lat === null || stop.lon === null
              ? Number.POSITIVE_INFINITY
              : metersBetween(rider, { lat: stop.lat, lon: stop.lon }),
        }))
        .sort((a, b) => a.distance - b.distance)[0]
    : null;

  const gpsUsable = Boolean(nearest && Number.isFinite(nearest.distance) && nearest.distance < GPS_USABLE_M);
  const offRoute = Boolean(
    nearest && Number.isFinite(nearest.distance) && nearest.distance > OFF_ROUTE_M && nearest.distance < GPS_USABLE_M,
  );

  let currentIndex = 0;
  let metersToAlight: number | null = null;
  if (gpsUsable && nearest) {
    currentIndex = nearest.index;
    if (rider && alight.lat !== null && alight.lon !== null) {
      metersToAlight = metersBetween(rider, { lat: alight.lat, lon: alight.lon });
    }
  } else {
    // GPS missing or drifting wildly: follow the timetable, smoothly.
    for (let index = 0; index <= endIndex; index += 1) {
      const seconds = stops[index]?.arriveSeconds;
      if (seconds !== null && seconds !== undefined && seconds <= nowSeconds) currentIndex = index;
    }
  }

  const stopsAway = Math.max(0, endIndex - currentIndex);
  const secondsToAlight =
    alight.arriveSeconds === null || alight.arriveSeconds === undefined ? null : alight.arriveSeconds - nowSeconds;
  const minutesToAlight = secondsToAlight === null ? null : Math.round(secondsToAlight / 60);
  const nextStop = stops[Math.min(currentIndex + 1, endIndex)] ?? alight;

  const base: Omit<ApproachResult, "state"> = {
    stopsAway,
    minutesToAlight,
    metersToAlight: metersToAlight === null ? null : Math.round(metersToAlight),
    nextStopName: nextStop.stopName ?? alight.stopName,
    alightName: alight.stopName,
    live: gpsUsable,
  };

  const first = distanceTrend[0];
  const last = distanceTrend[distanceTrend.length - 1];
  const movingAway =
    distanceTrend.length >= 2 && first !== undefined && last !== undefined && last - first > MOVING_AWAY_M;

  // Missed stop: clearly past the alight point rather than approaching it.
  const pastSchedule = secondsToAlight !== null && secondsToAlight < -PASSED_GRACE_SEC;
  if (metersToAlight !== null && metersToAlight > PASSED_M && (movingAway || pastSchedule)) {
    return { ...base, state: "passed" };
  }
  if (metersToAlight === null && pastSchedule && currentIndex >= endIndex) {
    return { ...base, state: "passed" };
  }

  // Off the planned corridor: mute the countdown instead of crying wolf.
  if (offRoute) return { ...base, state: "off-route" };

  const urgent =
    stopsAway <= 1
    || (metersToAlight !== null && metersToAlight <= 350)
    || (metersToAlight === null && minutesToAlight !== null && minutesToAlight <= 2);
  const getReady =
    !urgent
    && (stopsAway <= 2
      || (metersToAlight !== null && metersToAlight <= 800)
      || (metersToAlight === null && minutesToAlight !== null && minutesToAlight <= 4));

  let state: ApproachState = urgent ? "urgent" : getReady ? "ready" : "cruising";
  // Once the pull-cord alert is up it never quietly steps back down.
  if (previousState === "urgent" && state !== "urgent") state = "urgent";
  else if (previousState === "ready" && state === "cruising") state = "ready";
  return { ...base, state };
}

export type AlertPrefs = {
  sound: boolean;
  haptics: boolean;
  /** Keep the banner visible when the trip moves on to the next leg. */
  keepOnTransfer: boolean;
};

export const ALERT_PREFS_KEY = "nalu-alert-prefs-v1";

export const defaultAlertPrefs: AlertPrefs = { sound: true, haptics: true, keepOnTransfer: false };

export function parseAlertPrefs(raw: string | null): AlertPrefs {
  if (!raw) return defaultAlertPrefs;
  try {
    const parsed = JSON.parse(raw) as Partial<AlertPrefs>;
    return {
      sound: parsed.sound ?? defaultAlertPrefs.sound,
      haptics: parsed.haptics ?? defaultAlertPrefs.haptics,
      keepOnTransfer: parsed.keepOnTransfer ?? defaultAlertPrefs.keepOnTransfer,
    };
  } catch {
    return defaultAlertPrefs;
  }
}

/**
 * One shared audio context. iOS Safari only allows audio from a context that
 * was created or resumed inside a real user gesture, so the app primes this one
 * when the rider taps GO/Home/Work and reuses it for the arrival chime later.
 */
let sharedContext: AudioContext | null = null;

export function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedContext || sharedContext.state === "closed") sharedContext = new Ctx();
  return sharedContext;
}

/**
 * Call from a tap handler. Creates and unlocks the audio context (a silent
 * one-sample blip satisfies Safari's gesture requirement) so a later chime,
 * fired from a timer or GPS update, is not blocked.
 */
export function primeChimeAudio() {
  try {
    const ctx = audioContext();
    if (!ctx) return;
    void ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.01);
  } catch {
    // Priming is best-effort; never let it break a tap.
  }
}

/** Short synthesised two-note chime; silent failure when audio is blocked. */
export function playChime() {
  try {
    const ctx = audioContext();
    if (!ctx) return;
    // Resume in case iOS suspended the context while the screen was locked.
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    [880, 1320].forEach((frequency, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = frequency;
      const start = now + index * 0.18;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.15, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.32);
    });
  } catch {
    // An alert that cannot make sound must never break the screen.
  }
}


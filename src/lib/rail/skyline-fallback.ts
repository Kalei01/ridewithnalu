/**
 * Skyline schedule fallback metadata.
 *
 * Nalu uses GTFS stop_times as the source of truth whenever they are available.
 * This fallback is only for the small amount of UI that describes typical
 * headway when a station's timetable query returns no departures.
 *
 * DTS has publicly described Skyline as running every 10 minutes system-wide.
 * Real-world observation at Keone'ae (UH-West O'ahu) also shows a :02/:12/:22
 * cadence. The phase is intentionally metadata only; it must not replace GTFS
 * trip times or be presented as live train tracking.
 */

export const SKYLINE_FALLBACK_HEADWAY_MINUTES = 10;

const UH_WEST_NAMES = new Set([
  "keone'ae",
  "keoneʻae",
  "uh-west o'ahu",
  "uh-west oahu",
  "university of hawaii - west oahu",
  "university of hawaiʻi - west oʻahu",
]);

function normalized(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ");
}

/** Returns the observed minute-of-hour phase for UH-West, when known. */
export function skylineFallbackPhaseMinute(stopName: string | null | undefined): number | null {
  return UH_WEST_NAMES.has(normalized(stopName)) ? 2 : null;
}

/**
 * Returns the defensible fallback headway for a station.
 * GTFS-derived gaps should always be preferred by callers when available.
 */
export function skylineFallbackHeadwayMinutes(stopName: string | null | undefined): number {
  void stopName;
  return SKYLINE_FALLBACK_HEADWAY_MINUTES;
}

/**
 * Computes the next observed UH-West departure phase only when a caller has
 * explicitly decided to use the fallback. Returns null when no station phase
 * is known, so the app never invents a direction or a trip.
 */
export function nextSkylineFallbackDepartureSeconds(
  stopName: string | null | undefined,
  nowSeconds: number,
): number | null {
  const phase = skylineFallbackPhaseMinute(stopName);
  if (phase === null || !Number.isFinite(nowSeconds)) return null;
  const daySeconds = 24 * 60 * 60;
  const normalizedNow = ((Math.floor(nowSeconds) % daySeconds) + daySeconds) % daySeconds;
  const currentMinute = Math.floor(normalizedNow / 60);
  const currentSecond = normalizedNow % 60;
  let minute = currentMinute - (currentMinute % SKYLINE_FALLBACK_HEADWAY_MINUTES) + phase;
  if (minute * 60 <= normalizedNow || (minute * 60 === normalizedNow && currentSecond === 0)) {
    minute += SKYLINE_FALLBACK_HEADWAY_MINUTES;
  }
  return minute * 60;
}

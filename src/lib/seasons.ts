import { honoluluDateKey } from "@/lib/commute-formatting";

/**
 * Seasonal touches: a thin, dated layer (accent colour, one small motif, one
 * greeting line) on top of Nalu's normal look. Rules: docs/experience/seasonal.md.
 *
 * Everything is decided by the Honolulu calendar date, so a season switches
 * itself on and off. Nothing here touches commute logic.
 */

export type SeasonPhase = "on" | "afterglow";

/** A practical note with its own window, taken to the hour from an official source. */
export type SeasonNote = {
  text: string;
  /** Start of the window, as an instant with the Honolulu offset, e.g. "2026-10-24T16:00:00-10:00". */
  from: string;
  /** End of the window, same format. The note is hidden from this moment on. */
  until: string;
  source: string;
};

export type Season = {
  id: string;
  name: string;
  /** First day, "MM-DD" (Honolulu), repeating every year. */
  start: string;
  /** Last day, "MM-DD" (Honolulu), inclusive. May be before `start` when the season crosses New Year. */
  end: string;
  afterglowDays: number;
  /** Accent colours (CSS values), applied as CSS variables. Never used for meaning colours. */
  accent: { color: string; soft: string };
  /** Inline SVG markup for one small motif (kept under ~3 KB). Decorative only. */
  motif: string;
  greetings: string[];
  /** After-the-day lines. Empty means no greeting during the afterglow. */
  afterGreetings: string[];
  notes: SeasonNote[];
};

/** A simple pumpkin; decorative, so it is hidden from screen readers where it is used. */
const PUMPKIN_MOTIF =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true" focusable="false">' +
  '<path d="M12 6.5c.1-1.3.8-2.3 2-2.9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
  '<ellipse cx="8.2" cy="13" rx="5.2" ry="6" fill="currentColor" fill-opacity=".16" stroke="currentColor" stroke-width="1.5"/>' +
  '<ellipse cx="15.8" cy="13" rx="5.2" ry="6" fill="currentColor" fill-opacity=".16" stroke="currentColor" stroke-width="1.5"/>' +
  '<ellipse cx="12" cy="13" rx="2.4" ry="6.2" fill="currentColor" fill-opacity=".2" stroke="currentColor" stroke-width="1.3"/>' +
  "</svg>";

// Sources (checked 2026-10-14): none needed. Halloween is October 31 by
// definition and the greetings are decorative; no practical notes yet (no
// official closure or schedule source was checked).
export const SEASONS: Season[] = [
  {
    id: "halloween",
    name: "Halloween",
    start: "10-24",
    end: "10-31",
    afterglowDays: 5,
    accent: { color: "#f59a3d", soft: "rgba(245, 154, 61, 0.14)" },
    motif: PUMPKIN_MOTIF,
    greetings: [
      "Happy Halloween from Nalu.",
      "Halloween time. Give the little ones extra room on the road.",
      "Spooky season on Oʻahu. Nalu is watching the traffic, not the ghosts.",
    ],
    afterGreetings: ["Hope the candy haul was a good one."],
    notes: [],
  },
];

export type ActiveSeason = { season: Season; phase: SeasonPhase };

function addDays(key: string, days: number): string {
  const [y = 1970, m = 1, d = 1] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Start and end date keys of the season occurrence that begins in `year`. */
function occurrence(season: Season, year: number): { start: string; end: string } {
  const endYear = season.end < season.start ? year + 1 : year;
  return { start: `${year}-${season.start}`, end: `${endYear}-${season.end}` };
}

/**
 * The season that applies on this Honolulu day, or null. During a season's
 * afterglow the softer phase is returned, unless another season is starting:
 * a season in its lead-in or running wins over a previous afterglow.
 */
export function activeSeason(now: Date, seasons: Season[] = SEASONS): ActiveSeason | null {
  const key = honoluluDateKey(now);
  const year = Number(key.slice(0, 4));
  let on: ActiveSeason | null = null;
  let afterglow: { found: ActiveSeason; start: string } | null = null;
  for (const season of seasons) {
    for (const y of [year - 1, year]) {
      const { start, end } = occurrence(season, y);
      if (key >= start && key <= end) {
        on = on ?? { season, phase: "on" };
      } else if (key > end && key <= addDays(end, season.afterglowDays)) {
        if (!afterglow || start > afterglow.start) {
          afterglow = { found: { season, phase: "afterglow" }, start };
        }
      }
    }
  }
  return on ?? afterglow?.found ?? null;
}

/** Practical notes whose own window covers `now` (to the hour), whatever the season phase. */
export function activeNotes(now: Date, seasons: Season[] = SEASONS): SeasonNote[] {
  const t = now.getTime();
  return seasons
    .flatMap((season) => season.notes)
    .filter((note) => {
      const from = Date.parse(note.from);
      const until = Date.parse(note.until);
      return Number.isFinite(from) && Number.isFinite(until) && t >= from && t < until;
    });
}

/**
 * The greeting for today: the same line all day (picked from the date), or
 * null when the afterglow has no line. Never says the holiday greeting after it.
 */
export function seasonGreeting(active: ActiveSeason, now: Date): string | null {
  const lines = active.phase === "on" ? active.season.greetings : active.season.afterGreetings;
  if (!lines.length) return null;
  const day = Number(honoluluDateKey(now).replace(/-/g, ""));
  return lines[day % lines.length] ?? null;
}

const PREF_KEY = "nalu-seasonal-touches-v1";
const PREF_EVENT = "nalu-seasonal-touches-change";

/**
 * Runs in <head> before the page paints: marks <html> when the rider turned
 * seasonal touches off, so CSS hides the server-rendered seasonal line at once
 * (no flash, no layout shift). Keep the key in step with PREF_KEY.
 */
export const SEASON_OFF_SCRIPT =
  'try{if(localStorage.getItem("nalu-seasonal-touches-v1")==="off")document.documentElement.setAttribute("data-season-off","")}catch(e){}';

/** Seasonal touches are on unless the rider turned them off on this device. */
export function seasonalTouchesEnabled(): boolean {
  try {
    return window.localStorage.getItem(PREF_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSeasonalTouchesEnabled(enabled: boolean): void {
  try {
    if (enabled) window.localStorage.removeItem(PREF_KEY);
    else window.localStorage.setItem(PREF_KEY, "off");
  } catch {
    // Private mode or blocked storage: the choice just won't be remembered.
  }
  // Keep the early "off" marker (SEASON_OFF_SCRIPT) in step without a reload.
  if (enabled) document.documentElement.removeAttribute("data-season-off");
  else document.documentElement.setAttribute("data-season-off", "");
  window.dispatchEvent(new Event(PREF_EVENT));
}

export function onSeasonalTouchesChange(listener: () => void): () => void {
  window.addEventListener(PREF_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(PREF_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

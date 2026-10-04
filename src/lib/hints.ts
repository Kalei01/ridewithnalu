/**
 * Small "did you know" hints that point to a setting where it matters. Each
 * shows until it's used once, or after it has been seen on 5 different days,
 * so hints never become permanent clutter.
 */
import { honoluluDateKey } from "./commute-formatting";

const KEY = "nalu-hints-v1";
const MAX_DAYS = 5;

type HintState = Record<string, { days: string[]; used?: boolean }>;

function read(): HintState {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as HintState;
  } catch {
    return {};
  }
}

function write(state: HintState) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode */
  }
}

/** Today's date where the person is (Hawaiʻi or the test region), not UTC. */
function today() {
  return honoluluDateKey(new Date());
}

export function shouldShowHint(id: string, state = read(), day = today()): boolean {
  const entry = state[id];
  if (!entry) return true;
  if (entry.used) return false;
  return entry.days.includes(day) || entry.days.length < MAX_DAYS;
}

export function markHintSeen(id: string) {
  const state = read();
  const entry = state[id] ?? { days: [] };
  const day = today();
  if (!entry.days.includes(day)) entry.days = [...entry.days, day].slice(-MAX_DAYS);
  state[id] = entry;
  write(state);
}

export function markHintUsed(id: string) {
  const state = read();
  state[id] = { ...(state[id] ?? { days: [] }), used: true };
  write(state);
}

export type NaluPulsePeriod = "morning" | "evening";

const MORNING_LINES = [
  "Alright, here’s the move. 🤙",
  "Nalu checked it. Let’s get you there.",
  "Morning. One less thing to figure out.",
  "Here’s your move for the morning.",
  "Let’s get you to work without the guesswork.",
];

const EVENING_LINES = [
  "Alright, heading home.",
  "Let’s get you back home.",
  "Here’s the move home.",
  "Work’s done. Nalu’s got the trip home.",
  "Let’s get you home without the guesswork.",
];

function dayIndex(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const current = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((current - start) / 86_400_000);
}

/**
 * Small, deterministic personality layer for Pulse cards.
 * It does not inspect or change routing, ETA, traffic, transit, or weather data.
 */
export function naluPulseTagline(period: NaluPulsePeriod, date = new Date()): string {
  const lines = period === "morning" ? MORNING_LINES : EVENING_LINES;
  return lines[dayIndex(date) % lines.length];
}

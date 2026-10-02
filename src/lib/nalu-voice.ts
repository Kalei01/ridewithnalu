export type NaluPulsePeriod = "morning" | "evening";

export type NaluCommuteTone = "normal" | "traffic" | "rail" | "drive" | "rush";

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

const TRAFFIC_LINES = [
  "Traffic is doing traffic things today. 😅",
  "H-1 not cooperating this morning.",
  "Traffic no joke right now.",
];

const RAIL_LINES = [
  "Rail might be the move.",
  "Skyline is looking pretty good for this trip.",
  "Nalu’s leaning rail based on the numbers.",
];

const DRIVE_LINES = [
  "Driving is looking like the move.",
  "Roads are giving you the better run right now.",
  "Nalu’s leaning drive based on the numbers.",
];

const RUSH_LINES = [
  "If you can leave now, you can beat some of that buildup.",
  "Traffic is building. Earlier is looking better.",
  "This is one of those ‘leave a little sooner’ mornings.",
];

function dayIndex(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const current = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((current - start) / 86_400_000);
}

function pick(lines: string[], date = new Date(), offset = 0): string {
  return lines[(dayIndex(date) + offset) % lines.length];
}

/**
 * Small, deterministic personality layer.
 * These functions only provide copy. They do not inspect, change, or override
 * routing, ETA, traffic, transit, weather, or commute-decision logic.
 */
export function naluPulseTagline(period: NaluPulsePeriod, date = new Date()): string {
  return pick(period === "morning" ? MORNING_LINES : EVENING_LINES, date);
}

export function naluCommuteLine(tone: NaluCommuteTone, date = new Date()): string {
  switch (tone) {
    case "traffic":
      return pick(TRAFFIC_LINES, date);
    case "rail":
      return pick(RAIL_LINES, date);
    case "drive":
      return pick(DRIVE_LINES, date);
    case "rush":
      return pick(RUSH_LINES, date);
    default:
      return "Nalu checked it. Here’s the move.";
  }
}

export type NaluPulsePeriod = "morning" | "evening";

export type NaluCommuteTone =
  | "normal"
  | "traffic"
  | "rail"
  | "drive"
  | "rush"
  | "weather"
  | "roadwork"
  | "arrive"
  | "parking";

export type NaluCommuteContext = {
  period?: NaluPulsePeriod;
  tone?: NaluCommuteTone;
  trafficLevel?: "light" | "moderate" | "heavy" | "severe";
  decision?: "rail" | "drive" | "toss_up";
  timeDifferenceMinutes?: number;
  weatherImpact?: "none" | "minor" | "meaningful";
  roadworkActive?: boolean;
  roadworkScheduledLater?: boolean;
  isArriveBy?: boolean;
  parkingMinutes?: number;
  walkMinutes?: number;
  urgent?: boolean;
};

const MORNING_LINES = [
  "Alright, here’s the move. 🤙",
  "Nalu checked it. Let’s get you there.",
  "Morning. One less thing to figure out.",
  "Here’s your move for the morning.",
  "Let’s get you to work without the guesswork.",
  "Good morning. I checked the roads and rail.",
  "Your commute is checked. Here’s the plan.",
  "Nalu’s on it. Let’s get this commute handled.",
  "Quick commute check — here’s what I’m seeing.",
  "I ran the numbers. Here’s the move.",
  "Let’s make this morning a little easier.",
  "Your morning commute, sorted.",
];

const EVENING_LINES = [
  "Alright, heading home.",
  "Let’s get you back home.",
  "Here’s the move home.",
  "Work’s done. Nalu’s got the trip home.",
  "Time to make the trip back.",
  "Homebound. Here’s what I’m seeing.",
  "Nalu checked the evening run.",
  "Alright, let’s get you out of here.",
  "Heading back? I got you.",
  "Home stretch. Let’s check the commute.",
];

const TRAFFIC_LINES = [
  "Traffic no joke right now.",
  "The freeway is not cooperating this morning.",
  "The roads are getting pretty packed.",
  "Traffic is stacking up.",
  "Things are slowing down out there.",
  "The freeway is starting to drag.",
  "That drive is moving slower than usual.",
  "The morning buildup is underway.",
  "Yeah, the traffic is showing up today. 😅",
  "This one’s looking like a slower run.",
];

const RAIL_LINES = [
  "Rail might be the move.",
  "Skyline is looking good for this trip.",
  "Nalu’s leaning rail based on the numbers.",
  "Rail is looking solid for this run.",
  "The train is looking competitive.",
  "Rail has the cleaner run right now.",
  "Skyline is making a case for itself today.",
  "Rail is looking like a good way around the traffic.",
  "The numbers are pointing toward rail.",
  "For this trip, rail is holding its own.",
];

const DRIVE_LINES = [
  "Driving is looking like the move.",
  "The roads are giving you the better run.",
  "Nalu’s leaning drive based on the numbers.",
  "The drive is looking solid for this trip.",
  "Road time is coming out ahead.",
  "Driving has the edge on this run.",
  "The car is looking like the simpler move.",
  "The roads are working in your favor.",
  "Drive is holding the better time today.",
  "The numbers are pointing toward driving.",
];

const TOSS_UP_LINES = [
  "These two are pretty close right now.",
  "It’s a close call — neither option is running away with it.",
  "The times are close enough that either can make sense.",
  "Not much between rail and driving on this one.",
  "This one is too close for Nalu to force a call.",
  "Both options are in the same ballpark right now.",
];

const RUSH_LINES = [
  "If you can leave now, you can beat some of that buildup.",
  "Traffic is building. Earlier is looking better.",
  "The sooner you roll, the better this looks.",
  "The road is getting busier by the minute.",
  "This is a good time to get ahead of the rush.",
  "You’ve got a little window before things get heavier.",
  "The commute is heating up. Earlier looks cleaner.",
  "The buildup is coming. A head start could help.",
];

const WEATHER_LINES = [
  "Rain can change the drive pretty quickly.",
  "Wet roads today — give yourself a little extra breathing room.",
  "Weather is part of the commute today.",
  "Looks like the weather wants a say in the drive.",
  "Wet conditions can make the drive less predictable.",
  "A rainy commute calls for a little extra time.",
];

const ROADWORK_LINES = [
  "Quick heads-up: this roadwork is tied to the listed closure window.",
  "That closure is scheduled, so check the time before changing your plan.",
  "Roadwork noted. The timing matters here.",
  "Heads-up on the roadwork — it may only affect certain hours.",
  "This one’s a scheduled closure, not necessarily an all-day closure.",
  "Nalu flagged the work so you know what’s coming.",
];

const ARRIVE_LINES = [
  "You’ve got a target time. I’ll work backward from there.",
  "Let’s get you there on time without cutting it too close.",
  "Your arrival time is the priority here.",
  "We’re planning backward from when you need to arrive.",
  "Let’s give you a little breathing room.",
  "The goal is simple: get there when you need to be there.",
];

const PARKING_LINES = [
  "Getting there isn’t always the same as being parked.",
  "I’m leaving room for the part after the drive too.",
  "Give yourself a little buffer for parking and the walk in.",
  "The commute doesn’t end when the car stops moving.",
  "Parking can be the wild card, so a little buffer helps.",
];

function dayIndex(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const current = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((current - start) / 86_400_000);
}

function pick(lines: string[], date = new Date(), offset = 0): string {
  return lines[(dayIndex(date) + offset) % lines.length];
}

function pickContextual(lines: string[], context: NaluCommuteContext, date: Date): string {
  const offset =
    (context.timeDifferenceMinutes ?? 0) +
    (context.parkingMinutes ?? 0) +
    (context.walkMinutes ?? 0) +
    (context.urgent ? 7 : 0);
  return pick(lines, date, offset);
}

/**
 * Context-aware personality layer.
 * This layer only chooses copy. It never changes routing, ETA, traffic,
 * transit, weather, or commute-decision calculations.
 *
 * The caller can provide facts it already knows; the personality layer
 * decides whether a relevant line is useful and avoids unnecessary chatter.
 */
export function naluCommuteLine(
  tone: NaluCommuteTone,
  date = new Date(),
  context: NaluCommuteContext = {},
): string {
  if (tone === "normal") {
    if (context.decision === "toss_up") return pickContextual(TOSS_UP_LINES, context, date);
    return pickContextual(
      context.period === "evening" ? EVENING_LINES : MORNING_LINES,
      context,
      date,
    );
  }

  if (tone === "traffic") {
    if (context.trafficLevel === "light") return "";
    return pickContextual(TRAFFIC_LINES, context, date);
  }

  if (tone === "rail") return pickContextual(RAIL_LINES, context, date);
  if (tone === "drive") return pickContextual(DRIVE_LINES, context, date);
  if (tone === "rush") return pickContextual(RUSH_LINES, context, date);

  if (tone === "weather") {
    return context.weatherImpact === "meaningful"
      ? pickContextual(WEATHER_LINES, context, date)
      : "";
  }

  if (tone === "roadwork") {
    if (context.roadworkScheduledLater && !context.roadworkActive) {
      return pickContextual(ROADWORK_LINES, context, date);
    }
    return context.roadworkActive
      ? pickContextual(ROADWORK_LINES, context, date)
      : "";
  }

  if (tone === "arrive") {
    return context.isArriveBy ? pickContextual(ARRIVE_LINES, context, date) : "";
  }

  if (tone === "parking") {
    return (context.parkingMinutes ?? 0) > 0
      ? pickContextual(PARKING_LINES, context, date)
      : "";
  }

  return "";
}

export function naluHeroVerdictLine(
  context: NaluCommuteContext & { majorIncident?: boolean; trafficDelayMinutes?: number | null } = {},
  date = new Date(),
): string {
  const difference = context.timeDifferenceMinutes ?? null;
  const trafficDelay = context.trafficDelayMinutes ?? 0;

  // Give a close call its own neutral voice instead of pretending there is a winner.
  if (context.decision === "toss_up" || (difference !== null && difference <= 5)) {
    return pickContextual(TOSS_UP_LINES, context, date);
  }

  // When the drive is clearly affected, a little levity can reduce commute tension
  // without changing the factual verdict. Major incidents use the same human tone;
  // safety-critical wording remains in the underlying alert/roadwork UI.
  if (context.trafficLevel === "heavy" || context.trafficLevel === "severe" || trafficDelay >= 10 || context.majorIncident) {
    return pickContextual(TRAFFIC_LINES, context, date);
  }

  if (context.decision === "rail") return pickContextual(RAIL_LINES, context, date);
  if (context.decision === "drive") return pickContextual(DRIVE_LINES, context, date);
  return "";
}

export function naluPulseTagline(
  period: NaluPulsePeriod,
  date = new Date(),
  context: NaluCommuteContext = {},
): string {
  return naluCommuteLine("normal", date, { ...context, period });
}

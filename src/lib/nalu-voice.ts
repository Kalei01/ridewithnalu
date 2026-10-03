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

export type SmartNaluIncident = {
  description?: string | null;
  road?: string | null;
  delayMinutes?: number | null;
  category?: string | null;
  from?: string | null;
  to?: string | null;
};

export type SmartNaluRoadwork = {
  road?: string | null;
  description?: string | null;
  headline?: string | null;
  route?: string | null;
  active?: boolean;
};

export type SmartNaluWeather = {
  precipPercent?: number | null;
  shortForecast?: string | null;
  rain?: boolean;
  wetRoads?: boolean;
  impact?: "none" | "minor" | "meaningful";
};

export type SmartNaluContext = {
  driveMinutes: number | null | undefined;
  transitMinutes: number | null | undefined;
  timeDelta?: number | null;
  selectedMode?: "drive" | "transit" | "rail" | "toss_up" | "same" | null;
  decision?: "drive" | "transit" | "rail" | "toss_up" | "same" | null;
  incidents?: SmartNaluIncident[] | null;
  activeRoadwork?: SmartNaluRoadwork[] | SmartNaluRoadwork | null;
  weather?: SmartNaluWeather | SmartNaluWeather[] | null;
  period?: NaluPulsePeriod;
  trafficLevel?: "light" | "moderate" | "heavy" | "severe";
  transferMinutes?: number | null;
  transfers?: number | null;
  walkMinutes?: number | null;
  waitMinutes?: number | null;
  direction?: "morning-westbound" | "morning-eastbound" | "evening-westbound" | "evening-eastbound" | string | null;
};

export type NaluCommuteContext = {
  period?: NaluPulsePeriod;
  tone?: NaluCommuteTone;
  trafficLevel?: "light" | "moderate" | "heavy" | "severe";
  decision?: "rail" | "drive" | "toss_up";
  timeDifferenceMinutes?: number | undefined;
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
  return lines[(dayIndex(date) + offset) % lines.length] ?? lines[0] ?? "";
}

function pickContextual(lines: string[], context: NaluCommuteContext, date: Date): string {
  const offset =
    (context.timeDifferenceMinutes ?? 0) +
    (context.parkingMinutes ?? 0) +
    (context.walkMinutes ?? 0) +
    (context.urgent ? 7 : 0);
  return pick(lines, date, offset);
}

function asRoadworkList(value: SmartNaluContext["activeRoadwork"]): SmartNaluRoadwork[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function asWeatherList(value: SmartNaluContext["weather"]): SmartNaluWeather[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function cleanRoadName(value: string | null | undefined): string | null {
  if (!value) return null;
  const road = value.trim();
  if (!road) return null;
  return road
    .replace(/\bH1\b/gi, "H-1")
    .replace(/\bH2\b/gi, "H-2")
    .replace(/\bNimitz Highway\b/gi, "Nimitz")
    .replace(/\bFarrington Highway\b/gi, "Farrington")
    .replace(/\bKamehameha Highway\b/gi, "Kamehameha");
}

function incidentRoad(incident: SmartNaluIncident | undefined): string | null {
  if (!incident) return null;
  return cleanRoadName(incident.road) ?? cleanRoadName(incident.from) ?? null;
}

function majorIncidentFor(context: SmartNaluContext): SmartNaluIncident | undefined {
  return context.incidents?.find((incident) =>
    (incident.delayMinutes ?? 0) >= 10 ||
    /closure|closed|blocked|crash|collision|incident|disabled|lane/i.test(
      [incident.description, incident.category].filter(Boolean).join(" "),
    ),
  );
}

function hasWetWeather(context: SmartNaluContext): boolean {
  return asWeatherList(context.weather).some((weather) =>
    weather.wetRoads === true ||
    weather.rain === true ||
    weather.impact === "meaningful" ||
    (weather.precipPercent ?? 0) >= 30 ||
    /rain|showers|thunderstorm|wet/i.test(weather.shortForecast ?? ""),
  );
}

function weatherImpact(context: SmartNaluContext): "none" | "minor" | "meaningful" {
  if (hasWetWeather(context)) return "meaningful";
  return context.weather && asWeatherList(context.weather).some((weather) => weather.impact === "minor")
    ? "minor"
    : "none";
}

function transferFriction(context: SmartNaluContext): boolean {
  return (context.transferMinutes ?? 0) >= 15 ||
    (context.waitMinutes ?? 0) >= 15 ||
    (context.walkMinutes ?? 0) >= 15;
}

function formatMinutes(minutes: number): string {
  return Math.round(Math.abs(minutes)) === 1 ? "1 min" : `${Math.round(Math.abs(minutes))} min`;
}

function smartVariantSeed(context: SmartNaluContext): number {
  const text = [
    context.selectedMode,
    context.decision,
    context.direction,
    context.trafficLevel,
    incidentRoad(majorIncidentFor(context)),
    cleanRoadName(asRoadworkList(context.activeRoadwork).find((item) => item.active !== false)?.road),
    context.driveMinutes,
    context.transitMinutes,
    context.transferMinutes,
    context.waitMinutes,
    context.walkMinutes,
  ]
    .filter((value) => value !== null && value !== undefined)
    .join("|");

  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash);
}

function pickSmart(lines: string[], context: SmartNaluContext, offset = 0): string {
  if (lines.length === 0) return "";
  return lines[(smartVariantSeed(context) + offset) % lines.length] ?? lines[0] ?? "";
}

const DECISIVE_DRIVE_TAILS = [
  "H-1 is busy, but the car still has the cleanest shot.",
  "The roads are doing their thing, and the car still comes out ahead.",
  "Not exactly a scenic drive, but the numbers are clear.",
  "Traffic can have its moment. You’re still getting there sooner by car.",
  "The freeway is making you work for it, but the time savings are real.",
  "That’s enough time to make the traffic worth tolerating.",
  "H-1 may be loud today, but the stopwatch says drive.",
  "The drive wins this round without much drama.",
  "Not a perfect road day — just a better drive time.",
  "The car gets the nod on time, even with the usual freeway nonsense.",
  "Traffic is present. So is the time advantage.",
  "The road may be busy, but it’s still the faster play.",
];

const DECISIVE_TRANSIT_TAILS = [
  "Skyline + bus gets around the road mess and keeps the trip moving.",
  "H-1 can keep the drama — transit has the better time.",
  "That’s a big enough gap to let someone else do the driving.",
  "The road is taking the scenic route today. Transit isn’t.",
  "You’re giving up the steering wheel and getting there sooner. Not bad.",
  "This is one of those days when transit earns its keep.",
  "The freeway has a problem; your commute doesn’t have to.",
  "Let the bus and Skyline deal with the road situation.",
  "That’s a real time win, not a rounding error.",
  "The transit combo is doing some work today.",
  "The car has traffic. Transit has the clock.",
  "This is a pretty clean case for letting transit handle the grind.",
];

const CLOSE_CALL_TAILS = [
  "At that point, choose between traffic and transfers.",
  "That’s close enough that comfort can make the call.",
  "No heroics needed — pick the option you’d rather deal with.",
  "Five-ish minutes is basically a commute coin flip.",
  "The stopwatch isn’t giving us much to argue about.",
  "This is where personal preference gets a vote.",
  "Either way, you’re in roughly the same ballpark.",
  "No need to overthink a gap this small.",
  "Traffic or transfers — pick your adventure.",
  "That gap is small enough to choose based on how you feel about the trip.",
];

const INCIDENT_TAILS = [
  "Worth knowing before you roll.",
  "That’s the kind of thing that can change the drive quickly.",
  "A heads-up now is better than a surprise at the ramp.",
  "So yeah, that one is worth keeping an eye on.",
  "Consider that your advance warning.",
  "That’s not a detail I’d ignore on the way out.",
  "Better to know about it before you hit the road.",
  "That’s the traffic version of a yellow light.",
];

const TRANSFER_TAILS = [
  "The ride itself may be fine; the handoff is where the time goes.",
  "The transfer is doing a little too much of the heavy lifting today.",
  "That’s a decent chunk of time just waiting for the next piece.",
  "The trip is moving — eventually. The handoff is the slow part.",
  "The extra minutes are coming from the connection, not the ride.",
  "That transfer is the part to keep an eye on.",
  "The timetable has a little patience test built into it.",
  "The connection is where this trip starts to lose its shine.",
  "The ride may be faster, but the transfer is eating into it.",
  "That’s enough waiting to make the car look tempting.",
];

const WEATHER_TAILS = [
  "No need to race the rain.",
  "Give yourself a little extra breathing room.",
  "Wet roads are not the time to squeeze every minute.",
  "A few extra minutes beats white-knuckling the drive.",
  "Let the weather have its five minutes; you don’t need to.",
  "The goal is getting there, not beating the rain by thirty seconds.",
  "A little cushion goes a long way on a wet H-1.",
  "Keep it smooth — the roads don’t need extra excitement.",
];

const FALLBACK_TAILS = [
  "I’ll keep the call tied to the numbers.",
  "No guessing just to make the sentence sound confident.",
  "When the data gets clearer, the call gets clearer.",
  "I’d rather give you a real answer than a made-up one.",
  "Numbers first. Nonsense stays in the trunk.",
];


function modeLabel(mode: SmartNaluContext["selectedMode"]): "driving" | "transit" | "rail" {
  return mode === "transit" || mode === "rail" ? "transit" : "driving";
}

function contextDelta(context: SmartNaluContext): number | null {
  if (typeof context.timeDelta === "number" && Number.isFinite(context.timeDelta)) {
    return Math.abs(context.timeDelta);
  }
  if (
    typeof context.driveMinutes === "number" &&
    typeof context.transitMinutes === "number" &&
    Number.isFinite(context.driveMinutes) &&
    Number.isFinite(context.transitMinutes)
  ) {
    return Math.abs(context.driveMinutes - context.transitMinutes);
  }
  return null;
}

/**
 * Deterministic, metric-backed Nalu copy.
 *
 * Priority:
 * 1) substantial winner (>20 min)
 * 2) close call (<=8 min)
 * 3) major incident / closure
 * 4) transit transfer friction
 * 5) wet-weather impact
 */
export function generateSmartNaluInsight(context: SmartNaluContext): string {
  const drive = typeof context.driveMinutes === "number" ? context.driveMinutes : null;
  const transit = typeof context.transitMinutes === "number" ? context.transitMinutes : null;
  const delta = contextDelta(context);
  const mode = context.selectedMode ?? context.decision;
  const winner =
    mode === "drive" ? "drive" :
    mode === "transit" || mode === "rail" ? "transit" :
    drive !== null && transit !== null && drive !== transit
      ? drive < transit ? "drive" : "transit"
      : null;
  const incident = majorIncidentFor(context);
  const roadwork = asRoadworkList(context.activeRoadwork).find((item) => item.active !== false);
  const weather = weatherImpact(context);
  const seed = smartVariantSeed(context);

  // The first sentence always carries the factual commute call. Personality
  // stays in the second sentence so humor can never obscure the recommendation.
  if (drive !== null && transit !== null && delta !== null && delta > 20 && winner) {
    const saved = formatMinutes(delta);

    if (winner === "drive") {
      const road = incidentRoad(incident) ?? cleanRoadName(roadwork?.road) ?? cleanRoadName(roadwork?.route);
      const fact = road
        ? `Driving saves ${saved} over transit right now — ${road} is still the faster play.`
        : `Driving saves ${saved} over transit right now.`;
      const tail = road
        ? pickSmart(DECISIVE_DRIVE_TAILS, context, 3)
        : context.trafficLevel === "heavy" || context.trafficLevel === "severe"
          ? pickSmart(DECISIVE_DRIVE_TAILS, context, 7)
          : pickSmart(DECISIVE_DRIVE_TAILS, context);
      return `${fact} ${tail}`;
    }

    const road = incidentRoad(incident) ?? cleanRoadName(roadwork?.road) ?? cleanRoadName(roadwork?.route);
    const fact = road
      ? `Transit saves ${saved} over driving right now — it avoids the ${road} slowdown.`
      : `Transit saves ${saved} over driving right now.`;
    return `${fact} ${pickSmart(DECISIVE_TRANSIT_TAILS, context, seed % 5)}`;
  }

  if (drive !== null && transit !== null && delta !== null && delta <= 8) {
    const close = formatMinutes(delta);
    const fact = `Times are neck-and-neck (~${close} apart).`;
    const preference =
      mode === "transit" || mode === "rail"
        ? "Take transit if you want to skip driving stress."
        : mode === "drive"
          ? "Take the car if you want the simpler, flexible run."
          : "Either works — pick based on whether you want Skyline or the car.";
    return `${fact} ${preference} ${pickSmart(CLOSE_CALL_TAILS, context)}`;
  }

  if (incident || roadwork) {
    const road = incidentRoad(incident) ?? cleanRoadName(roadwork?.road) ?? cleanRoadName(roadwork?.route);
    const closureWord = roadwork || /closure|closed/i.test(incident?.description ?? "") ? "closure" : "incident";
    const fact = road
      ? `Heads-up: ${road} has a ${closureWord} affecting this route right now.`
      : `Heads-up: a major road ${closureWord} is affecting this route right now.`;
    return `${fact} ${pickSmart(INCIDENT_TAILS, context)}`;
  }

  if (transferFriction(context) && transit !== null) {
    const friction = context.transferMinutes ?? context.waitMinutes ?? context.walkMinutes ?? 0;
    return `Transit is picking up ${formatMinutes(friction)} from the transfer/wait. ${pickSmart(TRANSFER_TAILS, context)}`;
  }

  if (weather !== "none") {
    const fact = weather === "meaningful"
      ? "Wet roads can make the drive less predictable today."
      : "Weather may add a little variability to the drive today.";
    return `${fact} ${pickSmart(WEATHER_TAILS, context)}`;
  }

  if (winner === "transit") {
    return `Transit is looking like the cleaner run on the numbers. ${pickSmart(DECISIVE_TRANSIT_TAILS, context)}`;
  }

  if (winner === "drive") {
    return `Driving is looking like the cleaner run on the numbers. ${pickSmart(DECISIVE_DRIVE_TAILS, context)}`;
  }

  return `Nalu checked the trip. ${pickSmart(FALLBACK_TAILS, context)}`;
}

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
    return context.weatherImpact === "meaningful" ? pickContextual(WEATHER_LINES, context, date) : "";
  }
  if (tone === "roadwork") {
    if (context.roadworkScheduledLater && !context.roadworkActive) return pickContextual(ROADWORK_LINES, context, date);
    return context.roadworkActive ? pickContextual(ROADWORK_LINES, context, date) : "";
  }
  if (tone === "arrive") return context.isArriveBy ? pickContextual(ARRIVE_LINES, context, date) : "";
  if (tone === "parking") return (context.parkingMinutes ?? 0) > 0 ? pickContextual(PARKING_LINES, context, date) : "";
  return "";
}

export function naluHeroVerdictLine(
  context: NaluCommuteContext & {
    majorIncident?: boolean;
    trafficDelayMinutes?: number | null;
    driveMinutes?: number | null;
    transitMinutes?: number | null;
    incidents?: SmartNaluIncident[] | null;
    activeRoadwork?: SmartNaluRoadwork[] | SmartNaluRoadwork | null;
    weather?: SmartNaluWeather | SmartNaluWeather[] | null;
    transferMinutes?: number | null;
    waitMinutes?: number | null;
  } = {},
  date = new Date(),
): string {
  if (context.driveMinutes != null || context.transitMinutes != null) {
    return generateSmartNaluInsight({
      driveMinutes: context.driveMinutes,
      transitMinutes: context.transitMinutes,
      timeDelta: context.timeDifferenceMinutes,
      selectedMode: context.decision,
      incidents: context.incidents,
      activeRoadwork: context.activeRoadwork,
      weather: context.weather,
      trafficLevel: context.trafficLevel,
      transferMinutes: context.transferMinutes,
      waitMinutes: context.waitMinutes,
      period: context.period,
    });
  }

  const difference = context.timeDifferenceMinutes ?? null;
  const trafficDelay = context.trafficDelayMinutes ?? 0;

  if (context.decision === "toss_up" || (difference !== null && difference <= 5)) {
    return pickContextual(TOSS_UP_LINES, context, date);
  }

  if (context.trafficLevel === "heavy" || context.trafficLevel === "severe" || trafficDelay >= 10 || context.majorIncident) {
    return pickContextual(TRAFFIC_LINES, context, date);
  }

  if (context.decision === "rail") return pickContextual(RAIL_LINES, context, date);
  if (context.decision === "drive") return pickContextual(DRIVE_LINES, context, date);

  return "Nalu checked it. Here’s the move.";
}

export function naluPulseTagline(
  period: NaluPulsePeriod,
  date = new Date(),
  context: NaluCommuteContext = {},
): string {
  return naluCommuteLine("normal", date, { ...context, period });
}

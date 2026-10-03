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

  if (drive !== null && transit !== null && delta !== null && delta > 20 && winner) {
    const saved = formatMinutes(delta);
    if (winner === "drive") {
      const road = incidentRoad(incident);
      const reason = road
        ? ` — ${road} is still moving despite the traffic`
        : context.trafficLevel === "heavy" || context.trafficLevel === "severe"
          ? " — the drive still has the edge despite the volume"
          : "";
      return `Driving saves ${saved} over transit right now${reason}.`;
    }

    const road = incidentRoad(incident) ?? cleanRoadName(roadwork?.road) ?? cleanRoadName(roadwork?.route);
    const reason = road
      ? ` — transit avoids the ${road} slowdown`
      : incident || roadwork
        ? " — transit avoids the road slowdown"
        : "";
    return `Transit saves ${saved} over driving right now${reason}.`;
  }

  if (drive !== null && transit !== null && delta !== null && delta <= 8) {
    const close = formatMinutes(delta);
    return mode === "transit" || mode === "rail"
      ? `Times are neck-and-neck (~${close} apart). Take transit if you want to skip driving stress.`
      : mode === "drive"
        ? `Times are neck-and-neck (~${close} apart). Take the car if you want the simpler, flexible run.`
        : `Times are neck-and-neck (~${close} apart). Either works — pick based on whether you want Skyline or the car.`;
  }

  if (incident || roadwork) {
    const road = incidentRoad(incident) ?? cleanRoadName(roadwork?.road) ?? cleanRoadName(roadwork?.route);
    const closureWord = roadwork || /closure|closed/i.test(incident?.description ?? "") ? "closure" : "incident";
    if (road) {
      return `Heads-up: ${road} has a ${closureWord} affecting this route right now.`;
    }
    return `Heads-up: a major road ${closureWord} is affecting this route right now.`;
  }

  if (transferFriction(context) && transit !== null) {
    const friction = context.transferMinutes ?? context.waitMinutes ?? context.walkMinutes ?? 0;
    return `Transit is picking up some extra time from the ${formatMinutes(friction)} transfer/wait.`;
  }

  if (weather !== "none") {
    return weather === "meaningful"
      ? "Wet roads can make the drive less predictable today — give yourself a little breathing room."
      : "Weather may add a little variability to the drive today.";
  }

  if (winner === "transit") return "Transit is looking like the cleaner run on the numbers.";
  if (winner === "drive") return "Driving is looking like the cleaner run on the numbers.";
  return "Nalu checked the trip. I’ll call it when the numbers are clear.";
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

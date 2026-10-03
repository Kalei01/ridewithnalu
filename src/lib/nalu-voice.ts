import {
  ARRIVE_LINES,
  CLOSE_CALL_TAILS,
  DECISIVE_DRIVE_TAILS,
  DECISIVE_TRANSIT_TAILS,
  DRIVE_LINES,
  EVENING_LINES,
  FALLBACK_TAILS,
  INCIDENT_TAILS,
  MORNING_LINES,
  PARKING_LINES,
  RAIL_LINES,
  ROADWORK_LINES,
  RUSH_LINES,
  TOSS_UP_LINES,
  TRAFFIC_LINES,
  TRANSFER_TAILS,
  WEATHER_LINES,
  WEATHER_TAILS,
} from "./nalu-voice-bank";

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
    return `${fact} ${pickSmart(CLOSE_CALL_TAILS, context)}`;
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

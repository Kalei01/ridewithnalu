import { formatDriveMinutes } from "./drive/traffic-summary";
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
  timeDelta?: number | null | undefined;
  selectedMode?: "drive" | "transit" | "rail" | "toss_up" | "same" | null | undefined;
  decision?: "drive" | "transit" | "rail" | "toss_up" | "same" | null | undefined;
  incidents?: SmartNaluIncident[] | null | undefined;
  activeRoadwork?: SmartNaluRoadwork[] | SmartNaluRoadwork | null | undefined;
  weather?: SmartNaluWeather | SmartNaluWeather[] | null | undefined;
  period?: NaluPulsePeriod | undefined;
  trafficLevel?: "light" | "moderate" | "heavy" | "severe" | undefined;
  transferMinutes?: number | null | undefined;
  transfers?: number | null | undefined;
  walkMinutes?: number | null | undefined;
  waitMinutes?: number | null | undefined;
  direction?: "morning-westbound" | "morning-eastbound" | "evening-westbound" | "evening-eastbound" | string | null | undefined;
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
  "Morning. I checked the commute so you don’t have to.",
  "Good morning. Let’s make one less thing your problem.",
  "Quick check: here’s what the commute is doing.",
  "Morning check complete. Here’s what I found.",
  "Your commute has been looked at. Let’s keep it simple.",
  "I checked the roads and transit. Here’s the useful part.",
  "Morning. The commute report is in.",
  "Let’s get the day started without arguing with traffic.",
  "Coffee first. Commute second. I already checked it.",
  "Your morning has enough going on. I handled the commute check.",
  "Here’s the commute situation, minus the unnecessary drama.",
  "Alright, I did the checking. You just pick up and go.",
];

const EVENING_LINES = [
  "Heading home? I checked the trip.",
  "Work’s done. Let’s see what the ride home looks like.",
  "Quick check before you head out.",
  "Time to trade the workday for the trip home.",
  "I checked the evening commute. Here’s what’s up.",
  "Homebound. Let’s keep the trip straightforward.",
  "Before you head out, here’s what I’m seeing.",
  "Alright, let’s get you home without making this complicated.",
  "Your workday is over. The commute check is not.",
  "Heading back? I’ve got the numbers.",
  "Let’s see what the roads and transit are doing tonight.",
  "Home time. I checked the commute.",
];

const TRAFFIC_LINES = [
  "Traffic is getting serious right now.",
  "The freeway is having one of those days.",
  "The roads are filling in fast.",
  "Traffic is starting to bunch up.",
  "Things are slowing down out there.",
  "The drive is getting a little less friendly.",
  "That route is moving slower than usual.",
  "The morning traffic is building.",
  "Yeah, the roads are busy. I checked.",
  "This drive is going to need some patience.",
  "Traffic is doing what traffic does. Unfortunately.",
  "The road is asking for extra time today.",
];

const RAIL_LINES = [
  "Transit is looking good for this trip.",
  "Skyline is giving the drive some competition.",
  "The transit option is holding up well.",
  "Transit is coming out strong on the numbers.",
  "The train-and-bus option is looking pretty solid.",
  "Transit is keeping pace with the drive today.",
  "Skyline is worth a look on this one.",
  "The numbers give transit a real case here.",
  "Transit has a nice advantage right now.",
  "This is a pretty good day to let transit handle some of the commute.",
  "Transit is looking like a sensible option here.",
  "The transit trip is looking good. No sales pitch required.",
];

const DRIVE_LINES = [
  "Driving is coming out ahead on time.",
  "The car is giving you the shorter trip right now.",
  "Driving is looking good for this trip.",
  "The drive has the better time on this one.",
  "The car is ahead on time.",
  "Driving looks pretty straightforward today.",
  "The road option is coming out ahead.",
  "Driving is the shorter option right now.",
  "The car has the better clock today.",
];

const TOSS_UP_LINES = [
  "These two are really close.",
  "That’s a close one. Neither option is doing enough to brag.",
  "The times are close enough that either can work.",
  "Not much separates these two right now.",
  "This one is too close to pretend there’s a magic answer.",
  "Both options land in about the same neighborhood.",
  "That gap is small. Personal preference can take it from here.",
  "Very little between them right now.",
  "The clock is basically shrugging on this one.",
  "Close call. You’ve got options.",
  "Neither one has a meaningful time advantage.",
  "This is a choose-your-own-commute situation.",
];

const RUSH_LINES = [
  "Traffic is building. Leaving earlier could help.",
  "The road is getting busier, so the clock matters more now.",
  "You’ve got a window before things get heavier.",
  "Traffic is picking up. Earlier looks better.",
  "The buildup is starting. A little head start could save time.",
  "The commute is heating up.",
  "If you can leave soon, you may beat some of the buildup.",
  "The road is getting busier by the minute.",
  "Now is a decent time to get ahead of the rush.",
  "Traffic is starting to wake up. Not exactly an invitation.",
  "The later you leave, the less forgiving the road gets.",
  "You’ve got a little breathing room before the rush gets louder.",
];

const WEATHER_LINES = [
  "Rain can change the drive pretty quickly.",
  "Wet roads today. A little extra time is a good idea.",
  "Weather is part of the commute today.",
  "The forecast has entered the group chat.",
  "Wet conditions can make drive times less predictable.",
  "Rain is worth factoring into the trip.",
  "The road may take a little longer with weather in the mix.",
  "A rainy commute deserves a little extra cushion.",
  "Weather can turn a normal drive into a longer one.",
  "Give the road a little more room today.",
  "The rain may not ruin the commute, but it can change it.",
  "Today’s drive comes with a weather asterisk.",
];

const ROADWORK_LINES = [
  "Quick heads-up: roadwork is scheduled during the listed window.",
  "That roadwork has a time window, so the clock matters.",
  "Roadwork noted. Check the closure time before changing plans.",
  "That closure may only affect certain hours.",
  "Scheduled roadwork ahead. The timing is the important part.",
  "I flagged the roadwork so it doesn’t catch you by surprise.",
  "That closure is on the calendar, not necessarily all day.",
  "Roadwork is part of the picture here. Timing matters.",
  "Quick roadwork check: make sure the closure window matches your trip.",
  "That work could affect the route during the listed hours.",
  "Roadwork ahead. At least now you know before you roll.",
  "The closure has a schedule. Your commute should know about it.",
];

const ARRIVE_LINES = [
  "You gave me a target time, so I’m working backward from it.",
  "Arrival time comes first. Everything else works around that.",
  "Let’s get you there on time without cutting it close.",
  "I’m planning backward from when you need to arrive.",
  "Your arrival time is the part we don’t want to gamble with.",
  "Let’s leave enough room that one slow stretch doesn’t wreck the plan.",
  "The goal is simple: get there when you need to be there.",
  "I’m building in some breathing room around your arrival time.",
  "Getting there on time beats getting there by the skin of your teeth.",
  "We’ve got a deadline. I’m treating it like one.",
  "Your target time is set. Now we work backward.",
  "Let’s give the commute a little room to be imperfect.",
];

const PARKING_LINES = [
  "Getting there and getting parked are two different things.",
  "The drive isn’t finished just because the wheels stopped.",
  "Parking gets a seat at the table too.",
  "Give yourself a little time to find a spot and get inside.",
  "One more thing: arriving is not the same as being parked.",
  "The parking lot gets a vote, unfortunately.",
  "The last few minutes count too.",
  "Let’s not let parking be the surprise ending.",
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
  // HDOT and TomTom feeds carry internal segment IDs ("7852", "H-1_WB_16AAN",
  // "8930_-MP"); those are never rider-facing road names.
  if (/^\d+$/.test(road) || /[_+]/.test(road)) return null;
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
  return formatDriveMinutes(Math.abs(minutes));
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

/** Second sentence for a drive win, matched to live traffic. */
function driveTail(context: SmartNaluContext, hasCaution: boolean) {
  if (context.trafficLevel === "heavy" || context.trafficLevel === "severe")
    return pickSmart(BUSY_DRIVE_TAILS, context);
  // Don't call the roads easy when there's an incident or roadwork on them.
  if ((context.trafficLevel === "light" || context.trafficLevel === "moderate") && !hasCaution)
    return pickSmart(CLEAR_DRIVE_TAILS, context);
  return pickSmart(NEUTRAL_DRIVE_TAILS, context);
}

function pickSmart(lines: string[], context: SmartNaluContext, offset = 0): string {
  if (lines.length === 0) return "";
  return lines[(smartVariantSeed(context) + offset) % lines.length] ?? lines[0] ?? "";
}

// Only when live traffic is actually heavy: these lines say the road is busy.
const BUSY_DRIVE_TAILS = [
  "Traffic no joke right now, but the car still saves the time.",
  "Yeah, the road is busy. You’re still saving time by driving.",
  "Not exactly a relaxing drive, but it gets you there sooner.",
  "The road is a little ugly today, but driving still wins on time.",
  "Busy roads, shorter trip. That’s the trade-off.",
];

// Light or moderate traffic: the roads are fine, so say so.
const CLEAR_DRIVE_TAILS = [
  "Roads look good, so the car is the easy call.",
  "Traffic is moving fine. Driving is the quick way today.",
  "Easy drive right now. Take the car.",
];

// Traffic level unknown: no claim about the road either way.
const NEUTRAL_DRIVE_TAILS = [
  "That’s a real time savings. Worth knowing before you head out.",
  "The car wins this one on time. Pretty simple.",
];

const DECISIVE_TRANSIT_TAILS = [
  "That’s enough time saved to let somebody else deal with the road.",
  "Transit has the better clock today. Worth paying attention to.",
  "Bus and Skyline are doing some work for you today.",
  "The road can keep the traffic. Transit has the time.",
  "That’s a real time difference, not a rounding error.",
  "Transit saves enough time here to make a difference.",
  "Let somebody else handle the road for a bit.",
  "The car has the traffic. Transit has the better clock.",
];

const CLOSE_CALL_TAILS = [
  "At that point, pick the one you’d rather deal with.",
  "That’s close enough that comfort gets a vote.",
  "No need split hairs over a few minutes.",
  "The clock isn’t giving us much to argue about.",
  "Traffic or transfers — pick your adventure.",
  "A few minutes either way. Your call.",
  "That’s basically a commute coin flip.",
  "Close enough to go with what feels easier today.",
];

const INCIDENT_TAILS = [
  "A heads-up now is better than a surprise at the ramp.",
  "Good to know before you head out.",
  "Better to know now than find out in traffic.",
  "That could change the drive pretty quick.",
  "One less surprise for the commute.",
  "Worth knowing before you roll.",
];

const TRANSFER_TAILS = [
  "The handoff is where the minutes are going.",
  "That transfer is doing the time-consuming part.",
  "The ride is fine. The connection is the slow part.",
  "That’s a decent wait hiding inside the trip.",
  "The timetable has a little patience test built in.",
  "Those extra minutes are coming from the connection.",
];

const WEATHER_TAILS = [
  "No need to race the rain.",
  "Give yourself a little extra room today.",
  "Wet roads aren’t the place to chase every minute.",
  "Let the weather have its five minutes; you don’t need to.",
  "Keep it smooth. The rain is already enough excitement.",
  "A little cushion is worth it when the roads are wet.",
];

const FALLBACK_TAILS = [
  "Numbers first. Nonsense stays in the trunk.",
  "I’ll stick with what the data can actually tell us.",
  "No guessing just to sound confident.",
  "If the data changes, the answer changes.",
  "Real numbers beat a confident guess.",
  "Useful first. Everything else can wait.",
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
  // Scheduled roadwork is context, not evidence of a slowdown. Only roadwork
  // explicitly marked active may be described in the present tense.
  const roadworkItems = asRoadworkList(context.activeRoadwork).filter((item) => item.active !== false);
  const activeRoadwork = roadworkItems.find((item) => item.active === true);
  const roadwork = activeRoadwork ?? roadworkItems[0];
  const roadworkIsActive = roadwork?.active === true;
  const roadworkRoad = cleanRoadName(roadwork?.road) ?? cleanRoadName(roadwork?.route);
  const roadworkPhrase = roadworkRoad
    ? `${roadworkIsActive ? "roadwork" : "scheduled roadwork"} on ${roadworkRoad}`
    : null;
  const weather = weatherImpact(context);
  const seed = smartVariantSeed(context);

  // The first sentence always carries the factual commute call. Personality
  // stays in the second sentence so humor can never obscure the recommendation.
  if (drive !== null && transit !== null && delta !== null && delta > 20 && winner) {
    const saved = formatMinutes(delta);

    if (winner === "drive") {
      // An incident or roadwork road is a caution on the drive, never the reason
      // driving wins, so it is flagged rather than credited. Roadwork only
      // counts when it is happening now; a schedule elsewhere today is noise.
      const incidentOn = incidentRoad(incident);
      const activeRoad = activeRoadwork
        ? (cleanRoadName(activeRoadwork.road) ?? cleanRoadName(activeRoadwork.route))
        : null;
      const caution = incidentOn
        ? ` Heads up: incident on ${incidentOn}.`
        : activeRoad
          ? ` Heads up: roadwork on ${activeRoad}.`
          : "";
      const fact = `Driving saves ${saved} over transit right now.${caution}`;
      return `${fact} ${driveTail(context, Boolean(caution))}`;
    }

    // Only name a road as the cause when the provider measured a delay there.
    const slowRoad = (incident?.delayMinutes ?? 0) >= 5 ? incidentRoad(incident) : null;
    const fact = slowRoad
      ? `Transit saves ${saved} over driving right now — ${slowRoad} is slowing the drive.`
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
          : "Either works — pick based on whether you'd rather ride or drive.";
    return `${fact} ${preference} ${pickSmart(CLOSE_CALL_TAILS, context)}`;
  }

  if (incident) {
    const road = incidentRoad(incident);
    const closureWord = /closure|closed/i.test(incident.description ?? "") ? "closure" : "incident";
    const fact = road
      ? `Heads-up: ${road} has a reported ${closureWord} on this route.`
      : `Heads-up: a ${closureWord} is reported on this route.`;
    return `${fact} ${pickSmart(INCIDENT_TAILS, context)}`;
  }

  if (roadworkPhrase) {
    const fact = roadworkIsActive
      ? `Heads-up: ${roadworkPhrase} on this route right now.`
      : `Heads-up: HDOT lists ${roadworkPhrase} along this route. Check the hours before you go.`;
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
    return `Transit has the better time on the numbers. ${pickSmart(DECISIVE_TRANSIT_TAILS, context)}`;
  }

  if (winner === "drive") {
    return `Driving has the better time on the numbers. ${driveTail(context, Boolean(incident))}`;
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

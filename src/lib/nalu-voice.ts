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
  "The road option is looking good today.",
  "Driving has the better number on this one.",
  "The drive is coming out ahead.",
  "The car has a solid time advantage here.",
  "Driving is looking straightforward for this trip.",
  "The numbers are giving the car the edge.",
  "The road trip is holding up well today.",
  "Driving is the shorter option right now.",
  "The car is ahead on time. Pretty simple.",
  "The drive has the better clock on this one.",
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
  "I’m leaving room for parking and the walk in.",
  "The drive isn’t finished just because the wheels stopped.",
  "Parking gets a seat at the table too.",
  "I’m accounting for the part after the drive.",
  "Give yourself a little time to find a spot and get inside.",
  "One more thing: arriving is not the same as being parked.",
  "The parking lot gets a vote, unfortunately.",
  "I’m keeping a little buffer for parking.",
  "The last few minutes count too.",
  "Your commute includes the walk from the car. I’m counting it.",
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
  "The road is busy, but the time savings are real.",
  "Traffic is annoying. The clock is still on your side.",
  "The car comes out ahead, and the numbers aren’t being subtle.",
  "The freeway may complain. The stopwatch doesn’t.",
  "Not the world’s most exciting drive, but it gets you there sooner.",
  "The road has some attitude today, but driving still saves time.",
  "The car has the advantage where it counts: total time.",
  "Traffic is in the picture, but the drive still comes out ahead.",
  "The numbers are clear enough that I’m not going to overthink it.",
  "Driving saves enough time here to matter.",
  "The road is doing road things. The car is still faster.",
  "This one is pretty straightforward: the shorter trip is by car.",
];

const DECISIVE_TRANSIT_TAILS = [
  "That’s enough time saved to let somebody else deal with the road.",
  "Transit has the better clock today. I’d pay attention to that.",
  "The bus-and-Skyline combo is doing some heavy lifting here.",
  "The road can keep its traffic. Transit has the time advantage.",
  "That’s a real time difference, not a rounding error.",
  "Transit is saving enough time here to make the choice pretty clear.",
  "Let the transit system handle the grind for a while.",
  "The car has the traffic problem. Transit has the better total time.",
  "That’s a meaningful time win for transit.",
  "The numbers are doing the talking here.",
  "Transit is ahead by enough that it’s worth noticing.",
  "This is one of those trips where transit earns its spot.",
];

const CLOSE_CALL_TAILS = [
  "At that point, pick the one you’d rather spend the trip with.",
  "That’s close enough that comfort gets a vote.",
  "No need to split hairs over a few minutes.",
  "The clock isn’t giving us much to argue about.",
  "Either way, you’re in roughly the same time zone.",
  "This is where your preference can make the call.",
  "A few minutes either way isn’t worth a commute debate.",
  "Close enough that I’m not going to pretend there’s a perfect answer.",
  "Pick your preferred kind of inconvenience: traffic or transfers.",
  "The stopwatch has officially stopped taking sides.",
  "That gap is small enough to choose based on what sounds better.",
  "Sometimes the best answer is simply the one you’d rather take.",
];

const INCIDENT_TAILS = [
  "Good thing you know before you get there.",
  "That’s worth knowing before you head out.",
  "A heads-up now beats finding out at the ramp.",
  "That could change the drive pretty quickly.",
  "Consider that your advance warning.",
  "That’s the kind of detail you want before you leave.",
  "Better to know now than discover it in traffic.",
  "One less surprise for the commute.",
  "That’s worth keeping on your radar.",
  "I’d rather flag it now than have it surprise you later.",
  "That’s a useful thing to know before you roll.",
  "Traffic is easier to deal with when it isn’t a surprise.",
];

const TRANSFER_TAILS = [
  "The ride may be fine; the handoff is where the time goes.",
  "The transfer is doing more work than the ride itself.",
  "That’s a decent wait hiding inside the trip.",
  "The trip is moving, eventually. The connection is the slow part.",
  "Those extra minutes are coming from the connection.",
  "That transfer is the part I’d keep an eye on.",
  "The timetable is asking for a little patience.",
  "The connection is where this trip starts giving time back to the clock.",
  "The ride is fine. The handoff is eating the minutes.",
  "That’s enough waiting to make the car look interesting.",
  "The transfer is the tax on this particular trip.",
  "The connection is costing more time than it should.",
];

const WEATHER_TAILS = [
  "No need to race the rain.",
  "A little cushion is worth it when the roads are wet.",
  "Give yourself some room today.",
  "Wet roads are not the place to squeeze every last minute.",
  "A few extra minutes beats an unnecessarily stressful drive.",
  "Getting there safely is more useful than winning the stopwatch.",
  "Let the weather take its time. You don’t have to.",
  "A little extra breathing room goes a long way.",
  "Keep it smooth. The weather is already adding enough excitement.",
  "The road may need a little patience today.",
  "Rain changes the equation. A little buffer helps.",
  "Nobody gets a trophy for arriving thirty seconds earlier in the rain.",
];

const FALLBACK_TAILS = [
  "I’ll keep the answer tied to the data.",
  "No guessing just to make the answer sound confident.",
  "When the data is clear, the answer is clear.",
  "I’d rather give you a real answer than make one up.",
  "Numbers first. Extra drama can stay home.",
  "If the data changes, the answer changes.",
  "Real numbers beat a confident guess every time.",
  "I’m not going to invent a commute just to fill the silence.",
  "Keep it simple: data first, personality second.",
  "If I don’t know, I’d rather tell you than fake it.",
  "The goal is useful, not fancy.",
  "Good commute advice starts with good information.",
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

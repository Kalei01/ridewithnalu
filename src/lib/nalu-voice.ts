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

const MORNING_LINES = [
  "Alright, here’s the move. 🤙",
  "Nalu checked it. Let’s get you there.",
  "Morning. One less thing to figure out.",
  "Here’s your move for the morning.",
  "Let’s get you to work without the guesswork.",
  "Good morning. I checked the roads and rail.",
  "Your commute is checked. Here’s the plan.",
  "Let’s see what the morning is looking like.",
  "Nalu’s on it. Let’s get this commute handled.",
  "Here’s what the commute is giving us today.",
  "Quick commute check — you’re good to go.",
  "I ran the numbers. Here’s the move.",
  "Let’s make this morning a little easier.",
  "Your morning commute, sorted.",
  "Alright, let’s get you moving.",
  "Checked the commute. No guesswork needed.",
];

const EVENING_LINES = [
  "Alright, heading home.",
  "Let’s get you back home.",
  "Here’s the move home.",
  "Work’s done. Nalu’s got the trip home.",
  "Let’s get you home without the guesswork.",
  "Time to make the trip back.",
  "Homebound. Here’s what the roads are looking like.",
  "Let’s see what the ride home is doing.",
  "Nalu checked the evening run.",
  "Your trip home is checked.",
  "Alright, let’s get you out of here.",
  "One more commute, then you’re home.",
  "Heading back? I got you.",
  "Let’s make the ride home a little easier.",
  "The workday’s done. Here’s your move.",
  "Home stretch. Let’s check the commute.",
];

const TRAFFIC_LINES = [
  "Traffic is doing traffic things today. 😅",
  "H-1 not cooperating this morning.",
  "Traffic no joke right now.",
  "The roads are getting busy.",
  "H-1 is looking rough right now.",
  "Traffic is stacking up.",
  "The morning buildup is underway.",
  "That drive is moving slower than usual.",
  "Roads are getting pretty packed.",
  "This one’s looking like a slower run.",
  "Traffic has some catching up to do today.",
  "The road is not exactly wide open right now.",
  "Yeah, the traffic is showing up today. 😅",
  "Things are slowing down out there.",
  "That’s a heavier-than-usual drive.",
  "The freeway is starting to drag.",
];

const RAIL_LINES = [
  "Rail might be the move.",
  "Skyline is looking pretty good for this trip.",
  "Nalu’s leaning rail based on the numbers.",
  "Rail is looking solid for this run.",
  "Skyline may save you some road time today.",
  "The train is looking competitive this morning.",
  "Rail has the cleaner run right now.",
  "This trip is shaping up nicely for rail.",
  "Skyline is making a case for itself today.",
  "Rail is looking like a good way around the traffic.",
  "The numbers are giving rail a look.",
  "For this trip, rail is holding its own.",
  "Skyline is looking pretty steady right now.",
  "Rail could be the less-hassle option today.",
  "The train is looking like a reasonable move.",
  "Nalu’s numbers are pointing toward rail.",
];

const DRIVE_LINES = [
  "Driving is looking like the move.",
  "Roads are giving you the better run right now.",
  "Nalu’s leaning drive based on the numbers.",
  "The drive is looking solid for this trip.",
  "Road time is coming out ahead right now.",
  "Driving has the edge on this run.",
  "The car is looking like the simpler move.",
  "The roads are working in your favor right now.",
  "Drive is holding the better time today.",
  "For this trip, driving is coming out ahead.",
  "The numbers are pointing toward driving.",
  "Your car is looking pretty good for this commute.",
  "Drive is looking competitive today.",
  "The road is giving you the cleaner option.",
  "Nalu’s numbers are favoring the drive.",
  "Driving is shaping up well for this trip.",
];

const RUSH_LINES = [
  "If you can leave now, you can beat some of that buildup.",
  "Traffic is building. Earlier is looking better.",
  "This is one of those ‘leave a little sooner’ mornings.",
  "The sooner you roll, the better this looks.",
  "Traffic is starting to pile up.",
  "If your schedule allows, leaving a little early could help.",
  "The road is getting busier by the minute.",
  "This is a good time to get ahead of the rush.",
  "You’ve got a little window before things get heavier.",
  "The commute is heating up. Earlier looks cleaner.",
  "If you’re ready to go, now isn’t a bad time.",
  "The buildup is coming. A head start could help.",
  "This is trending toward a slower commute.",
  "Leaving soon may save you some of the peak buildup.",
  "The rush is starting to show.",
  "A few minutes earlier could make this run easier.",
];

const WEATHER_LINES = [
  "Rain can change the drive pretty quickly.",
  "Wet roads today — give yourself a little extra breathing room.",
  "Weather is part of the commute today.",
  "Looks like the weather wants a say in the drive.",
  "If the rain picks up, expect the road time to move around.",
  "Wet conditions can make the drive less predictable.",
  "Keep an eye on the rain — conditions can change fast.",
  "A rainy commute calls for a little extra time.",
];

const ROADWORK_LINES = [
  "Quick heads-up: this roadwork is tied to the listed closure window.",
  "That closure is scheduled, so check the time before changing your morning plan.",
  "Roadwork noted. The timing matters here.",
  "Heads-up on the roadwork — it may only affect certain hours.",
  "This one’s a scheduled closure, not necessarily an all-day closure.",
  "Roadwork is on the radar. Check the posted window for when it applies.",
  "The roadwork timing is the important part here.",
  "Nalu flagged the work so you know what’s coming before you leave.",
];

const ARRIVE_LINES = [
  "You’ve got a target time. I’ll work backward from there.",
  "Let’s get you there on time without cutting it too close.",
  "Your arrival time is the priority here.",
  "I’ll leave room for the commute instead of guessing at it.",
  "We’re planning backward from when you need to arrive.",
  "You’ve got a destination time — here’s the move to make it work.",
  "Let’s give you a little breathing room on the way there.",
  "The goal is simple: get there when you need to be there.",
];

const PARKING_LINES = [
  "Remember, getting there isn’t always the same as being parked.",
  "I’m leaving room for the part after the drive too.",
  "Arrival is one thing; finding a spot is another.",
  "Give yourself a little buffer for parking and the walk in.",
  "The commute doesn’t end when the car stops moving.",
  "I’m accounting for the last stretch after you arrive.",
  "Parking can be the wild card, so a little buffer helps.",
  "Once you’re parked, you may still have a short walk ahead.",
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
    case "weather":
      return pick(WEATHER_LINES, date);
    case "roadwork":
      return pick(ROADWORK_LINES, date);
    case "arrive":
      return pick(ARRIVE_LINES, date);
    case "parking":
      return pick(PARKING_LINES, date);
    default:
      return "Nalu checked it. Here’s the move.";
  }
}

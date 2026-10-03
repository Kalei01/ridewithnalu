/**
 * Nalu voice library.
 *
 * Keep commute logic out of this file. This is vocabulary only: organized by
 * the situations Nalu can recognize, so the library can grow without making
 * the decision engine harder to reason about.
 */

export const MORNING_LINES = [
  "Alright, here’s the move.",
  "Nalu checked it. Here’s what I’m seeing.",
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

export const EVENING_LINES = [
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

export const TRAFFIC_LINES = [
  "Traffic no joke right now.",
  "The freeway is not cooperating this morning.",
  "The roads are getting pretty packed.",
  "Traffic is stacking up.",
  "Things are slowing down out there.",
  "The freeway is starting to drag.",
  "That drive is moving slower than usual.",
  "The morning buildup is underway.",
  "Yeah, the traffic is showing up today.",
  "This one’s looking like a slower run.",
];

export const RAIL_LINES = [
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

export const DRIVE_LINES = [
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

export const TOSS_UP_LINES = [
  "These two are pretty close right now.",
  "It’s a close call — neither option is running away with it.",
  "The times are close enough that either can make sense.",
  "Not much between rail and driving on this one.",
  "This one is too close for Nalu to force a call.",
  "Both options are in the same ballpark right now.",
];

export const RUSH_LINES = [
  "If you can leave now, you can beat some of that buildup.",
  "Traffic is building. Earlier is looking better.",
  "The sooner you roll, the better this looks.",
  "The road is getting busier by the minute.",
  "This is a good time to get ahead of the rush.",
  "You’ve got a little window before things get heavier.",
  "The commute is heating up. Earlier looks cleaner.",
  "The buildup is coming. A head start could help.",
];

export const WEATHER_LINES = [
  "Rain can change the drive pretty quickly.",
  "Wet roads today — give yourself a little extra breathing room.",
  "Weather is part of the commute today.",
  "Looks like the weather wants a say in the drive.",
  "Wet conditions can make the drive less predictable.",
  "A rainy commute calls for a little extra time.",
];

export const ROADWORK_LINES = [
  "Quick heads-up: this roadwork is tied to the listed closure window.",
  "That closure is scheduled, so check the time before changing your plan.",
  "Roadwork noted. The timing matters here.",
  "Heads-up on the roadwork — it may only affect certain hours.",
  "This one’s a scheduled closure, not necessarily an all-day closure.",
  "Nalu flagged the work so you know what’s coming.",
];

export const ARRIVE_LINES = [
  "You’ve got a target time. I’ll work backward from there.",
  "Let’s get you there on time without cutting it too close.",
  "Your arrival time is the priority here.",
  "We’re planning backward from when you need to arrive.",
  "Let’s give you a little breathing room.",
  "The goal is simple: get there when you need to be there.",
];

export const PARKING_LINES = [
  "Getting there isn’t always the same as being parked.",
  "I’m leaving room for the part after the drive too.",
  "Give yourself a little buffer for parking and the walk in.",
  "The commute doesn’t end when the car stops moving.",
  "Parking can be the wild card, so a little buffer helps.",
];

export const DECISIVE_DRIVE_TAILS = [
  "H-1 is ugly this morning, but the car is still getting you there faster.",
  "H-1 is doing its usual thing, and drive still has the time.",
  "Not the prettiest drive, but it’s still the faster one.",
  "Traffic is there, but not enough to give up the time savings.",
  "Let the traffic complain. The car still wins on time.",
  "The freeway is moving slow, but the clock still says drive.",
  "That’s a real time win — I’d take the car and keep it moving.",
  "H-1 can be H-1. You’re still better off driving this one.",
  "You’ll deal with traffic, but you’ll also get there sooner.",
  "The road’s busy, but the gap is big enough to make driving worth it.",
  "This isn’t one of those five-minute calls. Drive has a real edge.",
  "Traffic might be annoying, but the time difference is doing the talking.",
];

export const DECISIVE_TRANSIT_TAILS = [
  "Let somebody else deal with H-1 today.",
  "H-1 can keep the drama — Skyline and the bus have this one.",
  "You get to skip the freeway and still get there sooner.",
  "That’s a real time win, not a close call.",
  "The road is taking its time. Transit isn’t.",
  "This is one of those days where letting somebody else drive makes sense.",
  "Skyline + bus is doing some work today.",
  "You can leave the traffic fight to somebody else.",
  "The car has the traffic. Transit has the better clock.",
  "That’s enough time saved to make the switch worthwhile.",
  "I’d let transit handle this one and leave the freeway alone.",
  "H-1 doesn’t get a vote today.",
];

export const CLOSE_CALL_TAILS = [
  "At that point, it’s really traffic vs. transfers.",
  "That’s close enough to pick whichever headache you’d rather have.",
  "No big winner here — go with what feels easier today.",
  "Five minutes either way isn’t worth overthinking.",
  "This is where comfort gets a vote.",
  "Traffic or transfers — your call.",
  "Either one gets the job done without a huge time difference.",
  "That gap is small enough to go with your preference.",
  "No need to force a winner when it’s this close.",
  "If you hate traffic, take transit. If you hate transfers, drive.",
];

export const INCIDENT_TAILS = [
  "Good to know before you hit the road.",
  "That’s worth knowing before you roll.",
  "Better to see that here than at the ramp.",
  "That one could change the drive pretty quick.",
  "Keep that one in mind before you head out.",
  "That’s the kind of thing you want a heads-up on.",
  "I’d keep an eye on that before leaving.",
  "At least you know about it before you get there.",
];

export const TRANSFER_TAILS = [
  "The transfer is where the extra time is hiding.",
  "That handoff is eating into the transit advantage.",
  "The ride is fine; the waiting is what’s getting you.",
  "That transfer kinda kills the advantage.",
  "The connection is doing most of the waiting today.",
  "The bus and train are fine — it’s the handoff that hurts.",
  "That’s a decent chunk of time just waiting for the next piece.",
  "The transfer is the part I’d watch here.",
  "The ride may be quick, but the connection is slowing it down.",
  "That wait is enough to make the car look tempting.",
];

export const WEATHER_TAILS = [
  "No need to race the rain.",
  "Give yourself a little extra breathing room.",
  "Wet roads are not the time to squeeze every minute.",
  "A few extra minutes beats white-knuckling the drive.",
  "Rain’s moving through. No need to rush it.",
  "Keep it smooth — the roads don’t need extra excitement.",
  "A little cushion goes a long way on a wet H-1.",
  "Let the weather do its thing. Just give yourself some room.",
];

export const FALLBACK_TAILS = [
  "I’ll keep the call tied to the numbers.",
  "No guessing just to make the sentence sound confident.",
  "When the data gets clearer, the call gets clearer.",
  "I’d rather give you a real answer than a made-up one.",
  "Numbers first. Nonsense stays in the trunk.",
];

/**
 * Grouped exports make the vocabulary easy to expand without changing the
 * decision engine. Add copy to the relevant category; do not put business
 * logic in this file.
 */
export const NALU_VOICE_LIBRARY = {
  base: {
    morning: MORNING_LINES,
    evening: EVENING_LINES,
    traffic: TRAFFIC_LINES,
    rail: RAIL_LINES,
    drive: DRIVE_LINES,
    tossUp: TOSS_UP_LINES,
    rush: RUSH_LINES,
    weather: WEATHER_LINES,
    roadwork: ROADWORK_LINES,
    arrive: ARRIVE_LINES,
    parking: PARKING_LINES,
  },
  smart: {
    decisiveDrive: DECISIVE_DRIVE_TAILS,
    decisiveTransit: DECISIVE_TRANSIT_TAILS,
    closeCall: CLOSE_CALL_TAILS,
    incident: INCIDENT_TAILS,
    transfer: TRANSFER_TAILS,
    weather: WEATHER_TAILS,
    fallback: FALLBACK_TAILS,
  },
} as const;

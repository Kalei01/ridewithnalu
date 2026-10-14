/**
 * What the home page's live parts read: the "Right now on Oʻahu" strip, the
 * live island and the race demo. Real data only; every part may be missing
 * (null) when its source couldn't be checked, and the page then hides it.
 */

/** A drive between Kapolei and downtown with live traffic (TomTom, the same check Browse uses). */
export type HomeTraffic = {
  /** "eastbound" = Kapolei → downtown, "westbound" = downtown → Kapolei. */
  direction: "eastbound" | "westbound";
  minutes: number;
  typicalMinutes: number;
  /** Minutes slower than usual right now (negative when better than usual). */
  delayMinutes: number;
  /** "Via Kualakaʻi Pkwy → H-1 East", when TomTom names the roads. */
  corridor: string | null;
  /** When the traffic was read (ms). */
  fetchedAt: number;
  /** The driven route, simplified: [lat, lon] pairs. */
  path: Array<[number, number]>;
  /** Slow stretches on that route. */
  sections: Array<{ severity: "moderate" | "heavy"; path: Array<[number, number]> }>;
};

/** A scheduled Skyline trip, by when it leaves the end of the line. */
export type HomeTrain = {
  /** Seconds after midnight (Honolulu service day) it leaves its first station. */
  departSeconds: number;
  /** GTFS stop id of its last station (a few trips turn back early). */
  endStopId: string | null;
};

export type HomeSkyline = {
  /** Trains leaving East Kapolei (Kualakaʻi) toward Kalihi Transit Center. */
  eastbound: HomeTrain[];
  /** Trains leaving Kalihi Transit Center (Kahauiki) toward East Kapolei. */
  westbound: HomeTrain[];
};

/** Showers in the NWS hourly forecast for a named area. */
export type HomeShowers = {
  area: string;
  /** Chance of rain this hour, 0–100, when NWS gives one. */
  percent: number | null;
  /** NWS wording, e.g. "Scattered Rain Showers". */
  forecast: string;
};

export type HomeLive = {
  /** When this answer was put together (ms). */
  generatedAt: number;
  /** Honolulu seconds after midnight at generatedAt. */
  serviceSeconds: number;
  traffic: { eastbound: HomeTraffic | null; westbound: HomeTraffic | null };
  skyline: HomeSkyline | null;
  showers: HomeShowers | null;
};

/** One leg of a race entrant, for drawing it on the map. */
export type HomeRaceLeg = {
  mode: "walk" | "drive" | "bus" | "rail";
  route: string | null;
  headsign: string | null;
  from: { stopId: string | null; lat: number | null; lon: number | null };
  to: { stopId: string | null; lat: number | null; lon: number | null };
  departSeconds: number | null;
  arriveSeconds: number | null;
};

/** One way to make the race trip, as the planner and live traffic give it. */
export type HomeRaceEntrant = {
  kind: "drive" | "skyline" | "bus";
  /** "Drive to UH West Oʻahu (Keoneʻae), parking not included → Skyline → Bus 42". */
  steps: string;
  /** When this way gets going (seconds after midnight): now for the car, the first scheduled departure otherwise. */
  startSeconds: number;
  /**
   * When it gets there (seconds after midnight). Drive: door to door with live
   * traffic, parking not included. Transit: when the last bus or train is
   * scheduled to arrive at its stop; walking is never estimated or added.
   */
  finishSeconds: number;
  legs: HomeRaceLeg[];
};

export type HomeRace = {
  /** When the trip was checked (ms). */
  checkedAt: number;
  /** Honolulu seconds after midnight at checkedAt. */
  checkedSeconds: number;
  from: { name: string; lat: number; lon: number };
  to: { name: string; lat: number; lon: number };
  /** The car's road route, simplified ([lat, lon]), when live traffic answered. */
  drivePath: Array<[number, number]> | null;
  entrants: HomeRaceEntrant[];
  /** True when this is the last good answer, not a fresh one (shown with its date and time). */
  lastKnown: boolean;
};

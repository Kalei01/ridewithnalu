import {
  DOWNTOWN_POINT,
  KAPOLEI_POINT,
  emptySetup,
  type Option,
  type RailStation,
} from "@/lib/commute-model";
import { honoluluSeconds } from "@/lib/commute-formatting";
import { planTripOnServer, plannerClient } from "@/lib/transit-plan.server";
import { resolveTripDirection } from "@/lib/trip-direction";
import { transitChoices, tripSteps } from "@/lib/trip-choices";
import { freshDrive } from "./home-live.server";
import { readShared, sharedAnswer, writeShared } from "./shared-cache.server";
import { simplifyPath } from "./simplify-path";
import type { HomeRace, HomeRaceEntrant, HomeRaceLeg } from "./home-types";

/** The race trip: the daily commute Nalu was built for (same ends as Browse's H-1 check). */
export const RACE_FROM = { name: "Kapolei", ...KAPOLEI_POINT };
export const RACE_TO = { name: "downtown Honolulu", ...DOWNTOWN_POINT };

/** A fresh race is shared this long; the last good one is kept a week for when checks fail. */
export const HOME_RACE_MAX_AGE_MS = 3 * 60_000;
const LAST_KNOWN_KEY = "home-race-last-v1";
const LAST_KNOWN_TTL_S = 7 * 24 * 3600;
const MISS_KEY = "home-race-miss-v1";
const MISS_TTL_S = 60;

type StopRow = {
  stop_id: string;
  stop_lat: number | string | null;
  stop_lon: number | string | null;
};

const transitLeg = (option: Option) =>
  [...option.legs].reverse().find((leg) => leg.mode === "bus" || leg.mode === "rail");

/**
 * A transit way, as the planner returned it. It finishes when its last bus or
 * train is scheduled to reach its stop, and starts at its first scheduled
 * departure: walking is never estimated or added (Josh, Oct 14, 2026).
 */
function transitEntrant(
  kind: "skyline" | "bus",
  option: Option,
  stops: Map<string, { lat: number; lon: number }>,
): HomeRaceEntrant | null {
  const last = transitLeg(option);
  const first = option.legs.find((leg) => leg.mode !== "walk");
  if (!last?.arrive_seconds || first?.depart_seconds == null) return null;
  const point = (stopId: string | null | undefined) => {
    const stop = stopId ? stops.get(stopId) : undefined;
    return { stopId: stopId ?? null, lat: stop?.lat ?? null, lon: stop?.lon ?? null };
  };
  const legs: HomeRaceLeg[] = option.legs.map((leg) => ({
    mode: leg.mode,
    route: leg.route_short ?? leg.route_long ?? null,
    headsign: leg.headsign,
    from: point(leg.from_stop_id),
    to: point(leg.to_stop_id),
    departSeconds: leg.depart_seconds,
    arriveSeconds: leg.arrive_seconds,
  }));
  return {
    kind,
    steps: tripSteps(option),
    startSeconds: first.depart_seconds,
    finishSeconds: last.arrive_seconds,
    legs,
  };
}

async function stopPoints(options: Option[]): Promise<Map<string, { lat: number; lon: number }>> {
  const ids = [
    ...new Set(
      options.flatMap((option) =>
        option.legs
          .flatMap((leg) => [leg.from_stop_id, leg.to_stop_id])
          .filter((id): id is string => Boolean(id)),
      ),
    ),
  ];
  const points = new Map<string, { lat: number; lon: number }>();
  if (!ids.length) return points;
  const { data } = await plannerClient()
    .from("stops")
    .select("stop_id,stop_lat,stop_lon")
    .in("stop_id", ids);
  for (const row of (data ?? []) as StopRow[]) {
    const lat = Number(row.stop_lat);
    const lon = Number(row.stop_lon);
    if (Number.isFinite(lat) && Number.isFinite(lon)) points.set(row.stop_id, { lat, lon });
  }
  return points;
}

/** One real check of the race trip: live traffic for the car, one planner search for Skyline and the bus. */
export async function buildHomeRace(): Promise<HomeRace | null> {
  const now = new Date();
  const nowSeconds = honoluluSeconds(now);
  const db = plannerClient();
  const [drive, stationReply, destReply, stationsReply] = await Promise.all([
    freshDrive({
      fromLat: RACE_FROM.lat,
      fromLon: RACE_FROM.lon,
      toLat: RACE_TO.lat,
      toLon: RACE_TO.lon,
    }).catch(() => null),
    db.rpc("nearest_stop", { p_lat: RACE_FROM.lat, p_lon: RACE_FROM.lon, p_rail_only: true }),
    db.rpc("directional_dest_stop", {
      p_lat: RACE_TO.lat,
      p_lon: RACE_TO.lon,
      p_toward_rail: false,
    }),
    db.rpc("rail_stations"),
  ]);
  const station = stationReply.data?.[0];
  const destStop = destReply.data?.[0];
  const setup = {
    ...emptySetup,
    allowDrive: true,
    homeStopId: station?.stop_id ?? "",
    homeStopName: station?.stop_name ?? "",
    homeLat: RACE_FROM.lat,
    homeLon: RACE_FROM.lon,
    destinationName: RACE_TO.name,
    destinationAddress: RACE_TO.name,
    destLat: RACE_TO.lat,
    destLon: RACE_TO.lon,
    destStopId: destStop?.stop_id ?? "",
    destStopName: destStop?.stop_name ?? "",
    destStopWalkM: Number(destStop?.distance_m ?? 0),
  };
  const tripDirection = resolveTripDirection({
    origin: { lat: RACE_FROM.lat, lon: RACE_FROM.lon },
    destination: { lat: RACE_TO.lat, lon: RACE_TO.lon },
    savedHome: null,
    manualInbound: null,
  });
  const afterSeconds = Math.floor(nowSeconds / 60) * 60;
  // Exactly what the trip screen asks for this trip with "Include driving" and Leave now.
  const plan = await planTripOnServer({
    arrivalStationId: setup.homeStopId,
    arriveByTarget: null,
    browseStations: (stationsReply.data ?? []) as RailStation[],
    vehicleToStation: "vehicle",
    inbound: tripDirection.inbound,
    now,
    nowSeconds,
    planMode: "leave-now",
    scheduleAfterSeconds: afterSeconds,
    setup,
    tripDirection,
  });

  const entrants: HomeRaceEntrant[] = [];
  if (drive && drive.trafficBasis === "live")
    entrants.push({
      kind: "drive",
      steps: drive.corridorLabel ?? "Drive",
      startSeconds: nowSeconds,
      finishSeconds: nowSeconds + drive.trafficMinutes * 60,
      legs: [],
    });
  if (!plan.failed) {
    const picks = transitChoices(plan.options, null);
    const chosen = [picks.skyline.option, picks.bus.option].filter((o): o is Option => Boolean(o));
    const stops = await stopPoints(chosen).catch(() => new Map());
    if (picks.skyline.option) {
      const entrant = transitEntrant("skyline", picks.skyline.option, stops);
      if (entrant) entrants.push(entrant);
    }
    if (picks.bus.option) {
      const entrant = transitEntrant("bus", picks.bus.option, stops);
      if (entrant) entrants.push(entrant);
    }
  }
  // Nothing real to race: say so rather than show a half-empty race.
  if (entrants.length < 2) return null;
  return {
    checkedAt: now.getTime(),
    checkedSeconds: nowSeconds,
    from: RACE_FROM,
    to: RACE_TO,
    drivePath: drive && drive.trafficBasis === "live" ? simplifyPath(drive.path, 40) : null,
    entrants,
    lastKnown: false,
    skylineUnchecked: plan.failed || plan.unchecked.skyline,
  };
}

/** A fresh race (shared a few minutes), else the last good one labelled as such, else null. */
export async function homeRace(): Promise<HomeRace | null> {
  // A check that found no race (late night, a planner failure) isn't repeated for a minute.
  const missed = await readShared<boolean>(MISS_KEY, MISS_TTL_S * 1000);
  const fresh = missed
    ? await readShared<HomeRace>("home-race-v1", HOME_RACE_MAX_AGE_MS)
    : await sharedAnswer("home-race-v1", HOME_RACE_MAX_AGE_MS, async () => {
        const race = await buildHomeRace().catch(() => null);
        if (race) await writeShared(LAST_KNOWN_KEY, race, LAST_KNOWN_TTL_S);
        else await writeShared(MISS_KEY, true, MISS_TTL_S);
        return race;
      });
  if (fresh) return fresh.value;
  const last = await readShared<HomeRace>(LAST_KNOWN_KEY, LAST_KNOWN_TTL_S * 1000);
  return last ? { ...last.value, lastKnown: true } : null;
}

import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));
vi.mock("@/lib/debug-log", () => ({ debugLog: vi.fn() }));
const driveTime = vi.fn();
vi.mock("@/lib/drive.functions", () => ({ driveTime: (...args: unknown[]) => driveTime(...args) }));

const { planTransitTrip } = await import("./transit-plan");
const { emptySetup } = await import("./commute-model");

type Reply = { data: unknown; error: unknown };
const ok = (data: unknown): Reply => ({ data, error: null });
const fail = (message: string): Reply => ({ data: null, error: { message } });

function option(depart: number, route = "40") {
  return {
    leave_by_seconds: depart - 300,
    depart_seconds: depart,
    arrive_seconds: depart + 2400,
    total_minutes: 45,
    legs: [
      {
        mode: "bus",
        route_short_name: route,
        depart_seconds: depart,
        arrive_seconds: depart + 2400,
      },
    ],
  };
}

function context(overrides: Record<string, unknown> = {}) {
  return {
    arrivalStationId: null,
    arriveByTarget: null,
    browseStations: [],
    carAtStation: false,
    vehicleToStation: "vehicle",
    inbound: false,
    now: new Date("2026-10-05T18:00:00Z"),
    nowSeconds: 8 * 3600,
    parkedToday: null,
    planMode: "leave-now" as const,
    scheduleAfterSeconds: 8 * 3600,
    setup: { ...emptySetup },
    tripDirection: {
      inbound: false,
      reverseTrip: false,
      departingFromSavedHome: false,
      arrivingAtSavedHome: false,
      from: { lat: 21.3365, lon: -158.0854 },
      to: { lat: 21.2911, lon: -157.843 },
    },
    ...overrides,
  } as unknown as Parameters<typeof planTransitTrip>[0];
}

/** Each planner answers from this table; anything else returns no rows. */
function answer(table: Record<string, Reply | ((args: Record<string, unknown>) => Reply)>) {
  rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    const entry = table[name];
    if (!entry) return ok([]);
    return typeof entry === "function" ? entry(args) : entry;
  });
}

describe("transit trip planner", () => {
  beforeEach(() => rpc.mockReset());

  it("returns a direct bus when the general planner finds nothing", async () => {
    answer({ plan_bus_direct: ok([option(8 * 3600 + 600)]) });
    const options = await planTransitTrip(context());
    expect(options).toHaveLength(1);
    expect(options[0]?.depart_seconds).toBe(8 * 3600 + 600);
  });

  it("reports a failure instead of 'no trip' when every planner errors", async () => {
    answer({
      plan_bus_direct: fail("timeout"),
      plan_transit_general: fail("timeout"),
      plan_outbound: fail("timeout"),
    });
    await expect(planTransitTrip(context())).rejects.toBeTruthy();
  });

  it("treats empty answers from every planner as a real 'no trip'", async () => {
    answer({});
    await expect(planTransitTrip(context())).resolves.toEqual([]);
  });

  it("after midnight, also searches yesterday's late-night service", async () => {
    answer({
      plan_bus_direct: (args) =>
        args["p_service_day_offset"] === -1 ? ok([option(86400 + 1800, "C")]) : ok([]),
    });
    const options = await planTransitTrip(
      context({ nowSeconds: 1800, scheduleAfterSeconds: 1800 }),
    );
    const offsets = rpc.mock.calls
      .filter(([name]) => name === "plan_bus_direct")
      .map(([, args]) => (args as Record<string, unknown>)["p_service_day_offset"]);
    expect(offsets).toEqual(expect.arrayContaining([0, -1]));
    // TheBus writes 24:30 for 12:30 AM; Nalu shifts it back onto today's clock.
    expect(options[0]?.depart_seconds).toBe(1800);
  });
});

describe("transit trip planner: bus → Skyline → bus", () => {
  beforeEach(() => rpc.mockReset());

  it("finds the Skyline trip home to ʻEwa Beach that beats the 42 alone", async () => {
    const KAHAUIKI = {
      stop_id: "10030",
      stop_name: "KAHAUIKI KALIHI TRANSIT CENTER STATION",
      stop_lat: "21.33274",
      stop_lon: "-157.888805",
    };
    const KUALAKAI = {
      stop_id: "10047",
      stop_name: "KUALAKA'I EAST KAPOLEI STATION",
      stop_lat: "21.345574",
      stop_lon: "-158.050995",
    };
    const walk = (kind: string, from: string, to: string, a: number, b: number) => ({
      kind,
      mode: "walk",
      from,
      to,
      minutes: Math.round((b - a) / 60),
      depart_seconds: a,
      arrive_seconds: b,
      route_short: null,
      route_long: null,
      headsign: null,
    });
    const ride = (mode: string, route: string, from: string, to: string, a: number, b: number) => ({
      kind: mode === "rail" ? "rail" : "connect",
      mode,
      route_short: route,
      route_long: null,
      headsign: null,
      from,
      to,
      minutes: Math.round((b - a) / 60),
      depart_seconds: a,
      arrive_seconds: b,
    });
    const busOnly = {
      leave_by_seconds: 62760,
      depart_seconds: 63120,
      arrive_seconds: 68940,
      total_minutes: 103,
      legs: [
        walk("access", "Your location", "S BERETANIA ST + BISHOP ST", 62760, 63120),
        ride(
          "bus",
          "42",
          "S BERETANIA ST + BISHOP ST",
          "FORT WEAVER RD + KEAUNUI DR",
          63120,
          67740,
        ),
        walk("egress", "FORT WEAVER RD + KEAUNUI DR", "Your destination", 67740, 68940),
      ],
    };
    const toStation = {
      leave_by_seconds: 61200,
      depart_seconds: 61560,
      arrive_seconds: 62520,
      total_minutes: 22,
      legs: [
        walk("access", "Your location", "S BERETANIA ST + BISHOP ST", 61200, 61560),
        ride("bus", "52", "S BERETANIA ST + BISHOP ST", "KAMEHAMEHA HWY + MIDDLE ST", 61560, 62460),
        walk("egress", "KAMEHAMEHA HWY + MIDDLE ST", "Your destination", 62460, 62520),
      ],
    };
    const fromStation = {
      leave_by_seconds: 63240,
      depart_seconds: 63240,
      arrive_seconds: 67140,
      total_minutes: 65,
      legs: [
        walk("access", "Your location", KAHAUIKI.stop_name, 63240, 63240),
        ride("rail", "", KAHAUIKI.stop_name, "HO'AE'AE WEST LOCH STATION", 63240, 64860),
        walk("connect", "HO'AE'AE WEST LOCH STATION", "FARRINGTON HWY + LEOKU ST", 64860, 65160),
        ride("bus", "42", "FARRINGTON HWY + LEOKU ST", "FORT WEAVER RD + KEAUNUI DR", 65160, 65940),
        walk("egress", "FORT WEAVER RD + KEAUNUI DR", "Your destination", 65940, 67140),
      ],
    };
    answer({
      rail_stations: ok([KAHAUIKI, KUALAKAI]),
      plan_transit_general: (args) => {
        if (Math.abs(Number(args["p_dest_lat"]) - 21.33274) < 1e-4) return ok([toStation]);
        if (Math.abs(Number(args["p_origin_lat"]) - 21.33274) < 1e-4) return ok([fromStation]);
        return ok([busOnly]);
      },
    });
    const options = await planTransitTrip(
      context({
        nowSeconds: 61200,
        scheduleAfterSeconds: 61200,
        tripDirection: {
          inbound: false,
          reverseTrip: false,
          departingFromSavedHome: false,
          arrivingAtSavedHome: false,
          from: { lat: 21.3101, lon: -157.8624 },
          to: { lat: 21.32203, lon: -158.03366 },
        },
      }),
    );
    expect(options[0]?.arrive_seconds).toBe(67140); // 6:39 PM via Skyline
    expect(
      options[0]?.legs.filter((l) => l.mode === "bus" || l.mode === "rail").map((l) => l.mode),
    ).toEqual(["bus", "rail", "bus"]);
    expect(options.some((o) => o.arrive_seconds === 68940)).toBe(true); // the 42 alone is still listed
  });
});

describe("transit trip planner: drive to the station + Skyline", () => {
  beforeEach(() => {
    rpc.mockReset();
    driveTime.mockReset();
  });

  const KUALAKAI = {
    stop_id: "10047",
    stop_name: "KUALAKA'I EAST KAPOLEI STATION",
    stop_lat: 21.345574,
    stop_lon: -158.050995,
  };
  const KEONEAE = {
    stop_id: "10046",
    stop_name: "KEONE'AE U.H. WEST OAHU STATION",
    stop_lat: 21.358532,
    stop_lon: -158.051188,
  };
  const leg = (
    kind: string,
    mode: string,
    route: string | null,
    from: string,
    to: string,
    a: number,
    b: number,
    toStop: string | null = null,
  ) => ({
    kind,
    mode,
    route_short: route,
    route_long: null,
    headsign: null,
    from,
    to,
    to_stop_id: toStop,
    minutes: Math.round((b - a) / 60),
    depart_seconds: a,
    arrive_seconds: b,
  });
  const trip = (from: { lat: number; lon: number }, nowSeconds: number) =>
    context({
      nowSeconds,
      scheduleAfterSeconds: nowSeconds,
      browseStations: [KUALAKAI, KEONEAE],
      setup: { ...emptySetup, homeStopId: KUALAKAI.stop_id },
      tripDirection: {
        inbound: false,
        reverseTrip: false,
        departingFromSavedHome: false,
        arrivingAtSavedHome: false,
        from,
        to: { lat: 21.30937, lon: -157.86318 },
      },
    });

  // ʻEwa Beach (91-1160 Kamakana St) to 55 Merchant St, Monday Oct 5, 2026 at 6:17 AM. The
  // general planner only found the 91 bus (arrive 7:49); drive + Skyline trips used to be
  // discarded, and the only station tried was the nearest one, Kualakaʻi, which has no lot.
  const NOW = 22620; // 6:17 AM
  const bus91 = {
    leave_by_seconds: 23160,
    depart_seconds: 24360,
    arrive_seconds: 28140,
    total_minutes: 83,
    legs: [
      leg("access", "walk", null, "Your location", "FORT WEAVER RD + RENTON RD", 23160, 24360),
      leg(
        "connect",
        "bus",
        "91",
        "FORT WEAVER RD + RENTON RD",
        "S KING ST + BETHEL ST",
        24360,
        28020,
      ),
      leg("egress", "walk", null, "S KING ST + BETHEL ST", "Your destination", 28020, 28140),
    ],
  };
  // Drive to Kualakaʻi (no park-and-ride): must never be offered.
  const driveToKualakai = {
    leave_by_seconds: 23520,
    depart_seconds: 24000,
    arrive_seconds: 27420,
    total_minutes: 65,
    legs: [
      leg(
        "access",
        "drive",
        null,
        "Your location",
        KUALAKAI.stop_name,
        23520,
        24000,
        KUALAKAI.stop_id,
      ),
      leg(
        "rail",
        "rail",
        null,
        KUALAKAI.stop_name,
        "KAHAUIKI KALIHI TRANSIT CENTER STATION",
        24000,
        26040,
      ),
      leg(
        "connect",
        "bus",
        "42",
        "KAMEHAMEHA HWY + OPP MIDDLE ST",
        "S KING ST + BETHEL ST",
        26280,
        27300,
      ),
      leg("egress", "walk", null, "S KING ST + BETHEL ST", "Your destination", 27300, 27420),
    ],
  };
  // Drive to Keoneʻae (UH West Oʻahu, park-and-ride), 6:44 train, 42 bus, arrive 7:39.
  const driveToKeoneae = {
    leave_by_seconds: 23640,
    depart_seconds: 24240,
    arrive_seconds: 27540,
    total_minutes: 65,
    legs: [
      leg(
        "access",
        "drive",
        null,
        "Your location",
        KEONEAE.stop_name,
        23640,
        24240,
        KEONEAE.stop_id,
      ),
      leg(
        "rail",
        "rail",
        null,
        KEONEAE.stop_name,
        "KAHAUIKI KALIHI TRANSIT CENTER STATION",
        24240,
        26160,
      ),
      leg(
        "connect",
        "bus",
        "42",
        "KAMEHAMEHA HWY + OPP MIDDLE ST",
        "S KING ST + BETHEL ST",
        26400,
        27420,
      ),
      leg("egress", "walk", null, "S KING ST + BETHEL ST", "Your destination", 27420, 27540),
    ],
  };
  const planners = () =>
    answer({
      plan_transit_general: ok([bus91]),
      plan_outbound: (args) =>
        args["p_station"] === KEONEAE.stop_id ? ok([driveToKeoneae]) : ok([driveToKualakai]),
    });

  it("drives only to a station with parking, timed with live traffic, and keeps the bus", async () => {
    planners();
    driveTime.mockResolvedValue({ trafficMinutes: 12 });
    const options = await planTransitTrip(trip({ lat: 21.32203, lon: -158.03366 }, NOW));
    const outboundCalls = rpc.mock.calls
      .filter(([name]) => name === "plan_outbound")
      .map(([, a]) => a as Record<string, unknown>);
    expect(outboundCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ p_station: KUALAKAI.stop_id, p_allow_drive: false }),
        expect.objectContaining({ p_station: KEONEAE.stop_id, p_allow_drive: true }),
      ]),
    );
    expect(options[0]?.arrive_seconds).toBe(27540); // 7:39 AM via UH West Oʻahu
    expect(options[0]?.legs.map((l) => l.mode)).toEqual(["drive", "rail", "bus", "walk"]);
    expect(options[0]?.legs[0]?.to_stop_id).toBe(KEONEAE.stop_id);
    expect(options[0]?.legs[0]?.minutes).toBe(15); // 12 min live traffic + 3 to park and board
    expect(options[0]?.leave_by_seconds).toBe(24240 - 15 * 60); // leave 6:29
    expect(
      options.some(
        (o) => o.legs[0]?.to_stop_id === KUALAKAI.stop_id && o.legs[0]?.mode === "drive",
      ),
    ).toBe(false);
    expect(options.some((o) => o.arrive_seconds === 28140)).toBe(true); // the car-free 91 stays
  });

  it("lists a drive + rail trip that saves too little over the bus as an alternative, not the pick", async () => {
    // Same trip at 6:41 AM: the 91 arrives 8:04; drive to Keoneʻae → Skyline → Route 1 arrives 7:58,
    // only 6 minutes sooner for an extra transfer. Shown second, never chosen.
    const NOW_LATER = 24060; // 6:41 AM
    const bus91Later = {
      leave_by_seconds: 24360,
      depart_seconds: 25560,
      arrive_seconds: 29040,
      total_minutes: 78,
      legs: [
        leg("access", "walk", null, "Your location", "FORT WEAVER RD + RENTON RD", 24360, 25560),
        leg(
          "connect",
          "bus",
          "91",
          "FORT WEAVER RD + RENTON RD",
          "S KING ST + BETHEL ST",
          25560,
          28920,
        ),
        leg("egress", "walk", null, "S KING ST + BETHEL ST", "Your destination", 28920, 29040),
      ],
    };
    const driveRailRoute1 = {
      leave_by_seconds: 24720,
      depart_seconds: 25320,
      arrive_seconds: 28680,
      total_minutes: 66,
      legs: [
        leg(
          "access",
          "drive",
          null,
          "Your location",
          KEONEAE.stop_name,
          24720,
          25320,
          KEONEAE.stop_id,
        ),
        leg(
          "rail",
          "rail",
          null,
          KEONEAE.stop_name,
          "KAHAUIKI KALIHI TRANSIT CENTER STATION",
          25320,
          27240,
        ),
        leg(
          "connect",
          "bus",
          "1",
          "KAMEHAMEHA HWY + OPP MIDDLE ST",
          "S HOTEL ST + BETHEL ST",
          27480,
          28560,
        ),
        leg("egress", "walk", null, "S HOTEL ST + BETHEL ST", "Your destination", 28560, 28680),
      ],
    };
    answer({
      plan_transit_general: ok([bus91Later]),
      plan_outbound: (args) =>
        args["p_station"] === KEONEAE.stop_id ? ok([driveRailRoute1]) : ok([]),
    });
    driveTime.mockResolvedValue({ trafficMinutes: 12 });
    const options = await planTransitTrip(trip({ lat: 21.32203, lon: -158.03366 }, NOW_LATER));
    expect(options[0]?.arrive_seconds).toBe(29040); // the 91 is the pick
    expect(options[0]?.extraTransfers).toBeUndefined();
    const alternative = options.find((o) => o.arrive_seconds === 28680);
    expect(alternative?.extraTransfers).toBe(true); // still listed, 6 min sooner
    expect(alternative?.legs.map((l) => l.mode)).toEqual(["drive", "rail", "bus", "walk"]);
  });

  it("drops drive-to-station trips when live traffic is unavailable, rather than guessing", async () => {
    planners();
    driveTime.mockResolvedValue(null);
    const options = await planTransitTrip(trip({ lat: 21.32203, lon: -158.03366 }, NOW));
    expect(options.some((o) => o.legs.some((l) => l.mode === "drive"))).toBe(false);
    expect(options[0]?.arrive_seconds).toBe(28140);
  });

  it("drops a train that live traffic says you can't reach in time", async () => {
    planners();
    driveTime.mockResolvedValue({ trafficMinutes: 30 }); // 6:17 + 33 min is after the 6:44 train
    const options = await planTransitTrip(trip({ lat: 21.32203, lon: -158.03366 }, NOW));
    expect(options.some((o) => o.legs.some((l) => l.mode === "drive"))).toBe(false);
  });

  it("doesn't suggest driving to a park-and-ride station within walking distance", async () => {
    // About 600 m from Keoneʻae, which has a lot: walk to the 6:44 train, don't drive.
    const walkKeoneae = {
      ...driveToKeoneae,
      leave_by_seconds: 23760,
      legs: [
        leg("access", "walk", null, "Your location", KEONEAE.stop_name, 23760, 24240),
        ...driveToKeoneae.legs.slice(1),
      ],
    };
    answer({ plan_transit_general: ok([walkKeoneae]), plan_outbound: ok([driveToKeoneae]) });
    driveTime.mockResolvedValue({ trafficMinutes: 2 });
    const options = await planTransitTrip(
      context({
        nowSeconds: NOW,
        scheduleAfterSeconds: NOW,
        browseStations: [KUALAKAI, KEONEAE],
        setup: { ...emptySetup, homeStopId: KEONEAE.stop_id },
        tripDirection: {
          inbound: false,
          reverseTrip: false,
          departingFromSavedHome: false,
          arrivingAtSavedHome: false,
          from: { lat: 21.3535, lon: -158.0512 },
          to: { lat: 21.30937, lon: -157.86318 },
        },
      }),
    );
    expect(options.some((o) => o.legs.some((l) => l.mode === "drive"))).toBe(false);
    expect(options[0]?.legs[0]?.mode).toBe("walk");
  });

  it("doesn't tell someone a short walk from the station to drive there", async () => {
    // About 1 km from Kualakaʻi: walk 13 min to the 6:40 train, or "drive 5 min" to the same train.
    const walkRail = {
      leave_by_seconds: 23220,
      depart_seconds: 24000,
      arrive_seconds: 27420,
      total_minutes: 70,
      legs: [
        leg("access", "walk", null, "Your location", KUALAKAI.stop_name, 23220, 24000),
        ...driveToKualakai.legs.slice(1),
      ],
    };
    answer({ plan_transit_general: ok([walkRail]), plan_outbound: ok([driveToKualakai]) });
    driveTime.mockResolvedValue({ trafficMinutes: 3 });
    const options = await planTransitTrip(trip({ lat: 21.3366, lon: -158.0505 }, NOW));
    expect(options.some((o) => o.legs.some((l) => l.mode === "drive"))).toBe(false);
    expect(options[0]?.legs[0]?.mode).toBe("walk");
  });

  describe("trip access", () => {
    // Waiawa has no park-and-ride lot, but someone can still drop a rider there.
    const WAIAWA = {
      stop_id: "10053",
      stop_name: "WAIAWA STATION",
      stop_lat: 21.3983,
      stop_lon: -157.9795,
    };
    const droppedAtWaiawa = {
      leave_by_seconds: 23700,
      depart_seconds: 24300,
      arrive_seconds: 26700,
      total_minutes: 50,
      legs: [
        leg(
          "access",
          "drive",
          null,
          "Your location",
          WAIAWA.stop_name,
          23700,
          24300,
          WAIAWA.stop_id,
        ),
        leg(
          "rail",
          "rail",
          null,
          WAIAWA.stop_name,
          "KAHAUIKI KALIHI TRANSIT CENTER STATION",
          24300,
          25500,
        ),
        leg(
          "connect",
          "bus",
          "42",
          "KAMEHAMEHA HWY + OPP MIDDLE ST",
          "S KING ST + BETHEL ST",
          25800,
          26580,
        ),
        leg("egress", "walk", null, "S KING ST + BETHEL ST", "Your destination", 26580, 26700),
      ],
    };
    const tripWith = (vehicleToStation: string) =>
      context({
        vehicleToStation,
        nowSeconds: NOW,
        scheduleAfterSeconds: NOW,
        browseStations: [KUALAKAI, KEONEAE, WAIAWA],
        setup: { ...emptySetup, homeStopId: KUALAKAI.stop_id },
        tripDirection: {
          inbound: false,
          reverseTrip: false,
          departingFromSavedHome: false,
          arrivingAtSavedHome: false,
          from: { lat: 21.32203, lon: -158.03366 },
          to: { lat: 21.30937, lon: -157.86318 },
        },
      });
    const outboundCalls = () =>
      rpc.mock.calls
        .filter(([name]) => name === "plan_outbound")
        .map(([, a]) => a as Record<string, unknown>);

    it("car available: also tries drop-off at stations with no lot, timed live", async () => {
      answer({
        plan_transit_general: ok([bus91]),
        plan_outbound: (args) =>
          args["p_station"] === WAIAWA.stop_id ? ok([droppedAtWaiawa]) : ok([]),
      });
      driveTime.mockResolvedValue({ trafficMinutes: 14 });
      const options = await planTransitTrip(tripWith("vehicle"));
      expect(outboundCalls()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ p_station: WAIAWA.stop_id, p_allow_drive: true }),
        ]),
      );
      const dropped = options.find((o) => o.legs[0]?.to_stop_id === WAIAWA.stop_id);
      expect(dropped?.legs[0]?.mode).toBe("drive");
      // No lot there, so live traffic plus a short walk to the platform, not parking time.
      expect(dropped?.legs[0]?.minutes).toBe(16);
      // Whether it wins is decided by comparing itineraries, not by the answer.
      expect(options.some((o) => o.arrive_seconds === 28140)).toBe(true);
    });

    it("car available: a station with a lot keeps its parking time", async () => {
      answer({
        plan_transit_general: ok([bus91]),
        plan_outbound: (args) =>
          args["p_station"] === KEONEAE.stop_id ? ok([driveToKeoneae]) : ok([]),
      });
      driveTime.mockResolvedValue({ trafficMinutes: 12 });
      const options = await planTransitTrip(tripWith("vehicle"));
      const parked = options.find((o) => o.legs[0]?.to_stop_id === KEONEAE.stop_id);
      expect(parked?.legs[0]?.minutes).toBe(15); // 12 min live traffic + 3 to park and board
    });

    it("never drives to a station with no lot that wasn't chosen as a drop-off point", async () => {
      // Kualakaʻi has no lot and leads away from town, so it isn't a drop-off candidate.
      answer({ plan_transit_general: ok([bus91]), plan_outbound: ok([driveToKualakai]) });
      driveTime.mockResolvedValue({ trafficMinutes: 6 });
      const options = await planTransitTrip(tripWith("vehicle"));
      expect(
        options.some(
          (o) => o.legs[0]?.to_stop_id === KUALAKAI.stop_id && o.legs[0]?.mode === "drive",
        ),
      ).toBe(false);
    });

    it("taking the bus: no car leg is ever requested or shown", async () => {
      answer({
        plan_transit_general: ok([bus91]),
        plan_outbound: ok([driveToKeoneae, droppedAtWaiawa]),
      });
      driveTime.mockResolvedValue({ trafficMinutes: 12 });
      const options = await planTransitTrip(tripWith("none"));
      expect(outboundCalls().every((a) => a["p_allow_drive"] === false)).toBe(true);
      expect(driveTime).not.toHaveBeenCalled();
      expect(options.length).toBeGreaterThan(0);
    });
  });
});

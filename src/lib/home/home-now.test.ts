import { describe, expect, it } from "vitest";
import {
  commutePeriod,
  delayPhrase,
  nextSkyline,
  skylineEveryMinutes,
  stripItems,
  trainAlong,
  trainPositions,
  type TimedStation,
} from "./home-now";
import type { HomeLive, HomeTraffic } from "./home-types";

// Three stations, 2 min apart with 30 s stops, west end first.
const stations: TimedStation[] = [
  { id: "10047", along: 0, east: [0, 0], west: [270, 300] },
  { id: "10046", along: 10, east: [120, 150], west: [120, 150] },
  { id: "10030", along: 30, east: [270, 300], west: [0, 0] },
];

const traffic = (over: Partial<HomeTraffic>): HomeTraffic => ({
  direction: "eastbound",
  minutes: 47,
  typicalMinutes: 38,
  delayMinutes: 9,
  corridor: "Via Kualakaʻi Pkwy → H-1 East",
  fetchedAt: 0,
  path: [],
  sections: [],
  ...over,
});

const live = (over: Partial<HomeLive> = {}): HomeLive => ({
  generatedAt: 0,
  serviceSeconds: 8 * 3600,
  traffic: {
    eastbound: traffic({}),
    westbound: traffic({ direction: "westbound", delayMinutes: 0 }),
  },
  skyline: { eastbound: [], westbound: [] },
  showers: null,
  ...over,
});

describe("trainAlong", () => {
  it("is halfway between stations halfway through the run", () => {
    expect(trainAlong(stations, "eastbound", 60, null)).toEqual({ along: 5, atStation: false });
  });
  it("waits at a station while its doors are open", () => {
    expect(trainAlong(stations, "eastbound", 130, null)).toEqual({ along: 10, atStation: true });
  });
  it("runs the other way westbound", () => {
    expect(trainAlong(stations, "westbound", 60, null)?.along).toBeCloseTo(20);
  });
  it("is off the line before it leaves and after it arrives", () => {
    expect(trainAlong(stations, "eastbound", -5, null)).toBeNull();
    expect(trainAlong(stations, "eastbound", 400, null)).toBeNull();
  });
  it("stops at the station a short trip ends at", () => {
    expect(trainAlong(stations, "eastbound", 140, "10046")).toEqual({ along: 10, atStation: true });
    expect(trainAlong(stations, "eastbound", 200, "10046")).toBeNull();
  });
});

describe("trainPositions", () => {
  it("places only trains on the line now", () => {
    const positions = trainPositions(
      {
        eastbound: [
          { departSeconds: 1000, endStopId: null },
          { departSeconds: 2000, endStopId: null },
        ],
        westbound: [],
      },
      stations,
      1060,
    );
    expect(positions).toEqual([
      { key: "eastbound:1000", direction: "eastbound", along: 5, atStation: false },
    ]);
  });
});

describe("strip", () => {
  it("talks about the town-bound drive in the morning", () => {
    const items = stripItems(live(), 8 * 3600);
    expect(items[0]).toEqual({
      id: "traffic",
      label: "H-1",
      text: "Kapolei → town 47 min, 9 min slower than usual",
    });
  });
  it("talks about the drive home in the afternoon", () => {
    const items = stripItems(live(), 16 * 3600);
    expect(items[0]?.text).toBe("Town → Kapolei 47 min, about usual");
  });
  it("never says 'about usual' without TomTom's usual-traffic answer", () => {
    const items = stripItems(
      live({
        traffic: {
          eastbound: traffic({ delayMinutes: null, typicalMinutes: null }),
          westbound: null,
        },
      }),
      8 * 3600,
    );
    expect(items[0]?.text).toBe("Kapolei → town 47 min");
  });
  it("leaves out everything it couldn't check", () => {
    expect(
      stripItems(live({ traffic: { eastbound: null, westbound: null }, skyline: null }), 8 * 3600),
    ).toEqual([]);
  });
  it("names the next Skyline with rider names", () => {
    const items = stripItems(
      live({
        skyline: {
          eastbound: [{ departSeconds: 8 * 3600 + 420, endStopId: "10030" }],
          westbound: [],
        },
      }),
      8 * 3600,
    );
    expect(items.find((i) => i.id === "skyline")?.text).toBe(
      "Next scheduled train from East Kapolei (Kualakaʻi): 8:07 AM",
    );
  });
  it("mentions showers only with the area and NWS chance", () => {
    const items = stripItems(
      live({ showers: { area: "Mānoa", percent: 40, forecast: "Rain Showers Likely" } }),
      8 * 3600,
    );
    expect(items.at(-1)).toEqual({
      id: "showers",
      label: "Showers",
      text: "Near Mānoa, 40% chance this hour",
    });
  });
});

describe("small phrases", () => {
  it("says delays plainly", () => {
    expect(delayPhrase(0.6)).toBe("about usual");
    expect(delayPhrase(-3)).toBe("3 min faster than usual");
    expect(delayPhrase(64)).toBe("1 hr 4 min slower than usual");
  });
  it("knows the commute periods", () => {
    expect(commutePeriod(7 * 3600)).toBe("morning");
    expect(commutePeriod(17 * 3600)).toBe("evening");
    expect(commutePeriod(12 * 3600)).toBe("other");
  });
  it("gives the gap riders will get next, not the one that just ended", () => {
    const trains = [0, 600, 1200, 1800, 2700, 3600, 4500].map((s) => ({
      departSeconds: s,
      endStopId: null,
    }));
    expect(skylineEveryMinutes(trains, 1900)).toBe(15);
  });
  it("gives a train frequency only for a steady service", () => {
    const steady = [0, 600, 1200, 1800].map((s) => ({ departSeconds: 3600 + s, endStopId: null }));
    expect(skylineEveryMinutes(steady, 3600)).toBe(10);
    const uneven = [0, 300, 1500, 1800].map((s) => ({ departSeconds: 3600 + s, endStopId: null }));
    expect(skylineEveryMinutes(uneven, 3600)).toBeNull();
  });
  it("names where a short trip ends", () => {
    const items = stripItems(
      live({
        skyline: {
          eastbound: [{ departSeconds: 8 * 3600 + 420, endStopId: "10053" }],
          westbound: [],
        },
      }),
      8 * 3600,
    );
    expect(items.find((i) => i.id === "skyline")?.text).toBe(
      "Next scheduled train from East Kapolei (Kualakaʻi): 8:07 AM, to Pearl Highlands (Waiawa)",
    );
  });
  it("finds no next train after the last one", () => {
    expect(
      nextSkyline(
        { eastbound: [{ departSeconds: 100, endStopId: null }], westbound: [] },
        8 * 3600,
      ),
    ).toBeNull();
  });
});

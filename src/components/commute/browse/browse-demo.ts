/**
 * Test states for /browse-preview?demo=… (development builds only; production never reads it).
 * Fixed clock plus fixed road checks, so the morning and evening screens can be seen
 * and photographed without waiting for a real accident. All numbers are samples.
 */
import type { DriveTime } from "@/lib/drive.functions";
import type { HdotScheduledClosure } from "@/lib/hdot-lane-closures.functions";
import type { RoadCheck } from "@/lib/browse-right-now";

export type BrowseDemo = { now: Date; checks: RoadCheck[]; closures: HdotScheduledClosure[] };

const hst = (hour: number, minute = 0) => new Date(Date.UTC(2026, 9, 21, hour + 10, minute));

// A rough H-1 line from Kapolei to downtown (sample geometry for the demo only).
const PATH = [
  [21.3358, -158.0798],
  [21.3427, -158.0405],
  [21.3495, -158.0095],
  [21.3736, -157.9715],
  [21.3859, -157.935],
  [21.3433, -157.909],
  [21.3279, -157.8806],
  [21.3099, -157.8644],
].map(([lat, lon]) => ({ lat: lat!, lon: lon! }));

function drive(over: Partial<DriveTime>): DriveTime {
  return {
    trafficMinutes: 36,
    typicalMinutes: 36,
    typicalChecked: true,
    delayMinutes: 0,
    lowMinutes: 33,
    highMinutes: 40,
    meters: 34000,
    path: PATH,
    trafficSections: [],
    incidents: [],
    corridorLabel: null,
    corridorRoads: ["H-1 East", "Nimitz Hwy"],
    bypassedRoads: [],
    maneuvers: [],
    fetchedAt: Date.now(),
    trafficBasis: "live",
    provider: "tomtom",
    incidentsAvailable: true,
    ...over,
  } as DriveTime;
}

const clear = (): RoadCheck => ({
  id: "kapolei-town",
  area: "Kapolei ↔ town",
  forward: drive({ hdotScheduledClosures: [KUNIA] }),
  back: drive({ path: [...PATH].reverse(), corridorRoads: ["Nimitz Hwy", "H-1 West"] }),
  loading: false,
  failed: false,
});

const KUNIA: HdotScheduledClosure = {
  route: "H-1",
  direction: "westbound",
  location: "Westbound Kalaeloa to Kunia, closure of two lanes",
  laneSummary: "2 lanes closed",
  schedule: "nightly from 8 p.m. to 5 a.m.",
  work: "paving",
};

export function browseDemo(name: string | null): BrowseDemo | null {
  switch (name) {
    case "morning-clear":
      return { now: hst(6, 45), checks: [clear()], closures: [KUNIA] };
    case "morning-incident": {
      const check = clear();
      check.forward = drive({
        delayMinutes: 9,
        trafficMinutes: 45,
        incidents: [
          {
            id: "demo-1",
            description: "Accident",
            road: "H-1",
            category: "1",
            from: "Aiea",
            to: "Pearl City",
            delayMinutes: 9,
            points: [PATH[4]!, PATH[3]!],
          },
        ],
        trafficSections: [{ severity: "heavy", delayMinutes: 9, points: PATH.slice(3, 6) }],
      });
      return { now: hst(7, 10), checks: [check], closures: [KUNIA] };
    }
    case "incident-kinds": {
      // One of each map icon: crash, police report, closure, roadwork (sample places only).
      const check = clear();
      const at = (i: number) => [PATH[i]!];
      check.forward = drive({
        delayMinutes: 9,
        trafficMinutes: 45,
        incidents: [
          {
            id: "k1",
            description: "Accident",
            road: "H-1",
            category: "1",
            from: "Aiea",
            to: "Pearl City",
            delayMinutes: 9,
            points: [PATH[4]!, PATH[3]!],
          },
          {
            id: "k2",
            delayMinutes: null,
            description: "Collision",
            road: "Kamehameha Hwy",
            category: "6",
            source: "hpd",
            reportedAt: new Date(Date.UTC(2026, 9, 21, 16, 50)).toISOString(),
            points: at(2),
          },
          {
            id: "k3",
            delayMinutes: null,
            description: "Closed",
            road: "H-1",
            category: "8",
            from: "Waipahu",
            to: "Pearl City",
            points: [PATH[5]!, PATH[5]!],
          },
          {
            id: "k4",
            delayMinutes: null,
            description: "Works",
            road: "Nimitz Hwy",
            category: "9",
            points: at(6),
          },
        ],
        trafficSections: [
          { severity: "heavy", delayMinutes: 9, points: PATH.slice(3, 6) },
          { severity: "moderate", delayMinutes: 3, points: PATH.slice(0, 3) },
        ],
      });
      return { now: hst(7, 10), checks: [check], closures: [KUNIA] };
    }
    case "evening":
      return { now: hst(17, 40), checks: [clear()], closures: [KUNIA] };
    default:
      return null;
  }
}

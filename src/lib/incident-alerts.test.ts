import { describe, expect, it } from "vitest";
import type { DriveIncident } from "./drive.functions";
import { nearbyIncidentFrom } from "./drive.functions";
import {
  incidentAlertKey,
  incidentHudText,
  incidentSpeech,
  incidentWhere,
  detailedAlertCovers,
  isAlertIncident,
  isOppositeDirection,
  newIncidentAlertMemory,
  planIncidentAlerts,
} from "./incident-alerts";

// Eastbound road, ~110 m per step, lat 21.34.
const path = Array.from({ length: 40 }, (_, i) => ({ lat: 21.34, lon: -157.95 + i * 0.001 }));
const at = (i: number, dLat = 0) => [{ lat: 21.34 + dLat, lon: -157.95 + i * 0.001 }];

const accident: DriveIncident = {
  id: "abc123",
  description: "Accident",
  category: "1",
  road: "H-1 East",
  from: "Aiea",
  to: null,
  delayMinutes: 8,
  points: at(20),
};

describe("accident alert wording", () => {
  it("says what and where, with the delay only when reported", () => {
    expect(incidentSpeech(accident)).toBe(
      "Reported accident on H-1 East near Aiea, adding about 8 minutes.",
    );
    expect(incidentHudText(accident)).toBe("+8 min · Accident on H-1 East near Aiea");
    const noDelay = { ...accident, delayMinutes: null };
    expect(incidentSpeech(noDelay)).toBe("Reported accident on H-1 East near Aiea.");
    expect(incidentHudText(noDelay)).toBe("Accident on H-1 East near Aiea");
  });
  it("uses the named stretch, and never invents a place", () => {
    expect(incidentWhere({ ...accident, from: "Aiea", to: "Pearl City" })).toBe(
      "between Aiea and Pearl City",
    );
    expect(incidentWhere({ ...accident, from: null, to: null })).toBeNull();
    expect(incidentSpeech({ ...accident, from: null, delayMinutes: null })).toBe(
      "Reported accident on H-1 East.",
    );
  });
  it("only accidents and closures interrupt a drive", () => {
    expect(isAlertIncident(accident)).toBe(true);
    expect(isAlertIncident({ ...accident, category: "8" })).toBe(true);
    expect(isAlertIncident({ ...accident, category: "6" })).toBe(false);
    expect(isAlertIncident({ ...accident, category: "9" })).toBe(false);
  });
  it("keys on TomTom's id, else category/road/place/position", () => {
    expect(incidentAlertKey(accident)).toBe("id:abc123");
    expect(incidentAlertKey({ ...accident, id: null })).toContain("H-1 East");
  });
  it("skips the other carriageway by the incident line's own direction, even for plain 'H-1'", () => {
    const eastLine = [at(20)[0]!, at(22)[0]!];
    const westLine = [at(22)[0]!, at(20)[0]!];
    expect(isOppositeDirection({ ...accident, road: "H-1", points: westLine }, path)).toBe(true);
    expect(isOppositeDirection({ ...accident, road: "H-1", points: eastLine }, path)).toBe(false);
    // A stated direction only decides when the geometry is too short to tell.
    expect(isOppositeDirection({ ...accident, road: "H-1 West" }, path)).toBe(true);
    expect(isOppositeDirection(accident, path)).toBe(false);
    expect(isOppositeDirection({ ...accident, road: "Nimitz Hwy" }, path)).toBe(false);
  });
});

describe("planIncidentAlerts", () => {
  it("speaks an on-route accident once per incident id across refreshes", () => {
    const memory = newIncidentAlertMemory();
    const first = planIncidentAlerts({ incidents: [accident], path }, memory);
    expect(first.speak).toHaveLength(1);
    expect(first.hud?.offRoute).toBe(false);
    const again = planIncidentAlerts({ incidents: [{ ...accident }], path }, memory);
    expect(again.speak).toHaveLength(0);
    expect(again.hud?.text).toContain("Accident on H-1 East near Aiea");
  });

  it("keeps a 'reported ahead' notice after a reroute avoids it, without speaking again", () => {
    const memory = newIncidentAlertMemory();
    planIncidentAlerts({ incidents: [accident], path }, memory);
    const avoided = planIncidentAlerts(
      { incidents: [], nearby: [{ ...accident, onRoute: false }], path },
      memory,
    );
    expect(avoided.speak).toHaveLength(0);
    expect(avoided.hud?.offRoute).toBe(true);
    expect(avoided.hud?.label).toBe("Nearby — not on your route");
    expect(avoided.hud?.text).not.toMatch(/reported ahead/i);
  });

  it("stays silent about an off-route accident the driver never had on the route", () => {
    const plan = planIncidentAlerts(
      { incidents: [], nearby: [{ ...accident, onRoute: false }], path },
      newIncidentAlertMemory(),
    );
    expect(plan.speak).toHaveLength(0);
    expect(plan.hud).toBeNull();
  });

  it("alerts for a minor-delay accident that sits on the route even when only the nearby list has it", () => {
    const plan = planIncidentAlerts(
      { incidents: [], nearby: [{ ...accident, delayMinutes: null, onRoute: true }], path },
      newIncidentAlertMemory(),
    );
    expect(plan.speak).toHaveLength(1);
    expect(plan.hud?.offRoute).toBe(false);
  });

  it("ignores the opposite direction and non-accident incidents", () => {
    const plan = planIncidentAlerts(
      {
        incidents: [
          { ...accident, road: "H-1 West" },
          { ...accident, id: "x", category: "6" },
        ],
        path,
      },
      newIncidentAlertMemory(),
    );
    expect(plan.speak).toHaveLength(0);
    expect(plan.hud).toBeNull();
  });
});

describe("ahead / nearby / behind along the route", () => {
  const rider = (i: number) => ({ lat: 21.34, lon: -157.95 + i * 0.001 });
  it("labels an incident ahead of the rider and drops one already passed", () => {
    const ahead = planIncidentAlerts(
      { incidents: [accident], path, rider: rider(10) },
      newIncidentAlertMemory(),
    );
    expect(ahead.hud?.label).toBe("Reported ahead");
    const passedMemory = newIncidentAlertMemory();
    const behind = planIncidentAlerts(
      { incidents: [accident], path, rider: rider(30) },
      passedMemory,
    );
    expect(behind.speak).toHaveLength(0);
    expect(behind.hud).toBeNull();
  });
  it("says 'Avoided' for an avoided incident ahead, 'Nearby' when position is unknown", () => {
    const memory = newIncidentAlertMemory();
    planIncidentAlerts({ incidents: [accident], path, rider: rider(5) }, memory);
    const avoided = planIncidentAlerts(
      { incidents: [], nearby: [{ ...accident, onRoute: false }], path, rider: rider(10) },
      memory,
    );
    expect(avoided.hud?.label).toBe("Avoided — not on your route");
    const unknown = planIncidentAlerts({ incidents: [accident], path }, newIncidentAlertMemory());
    expect(unknown.hud?.label).toBe("Reported nearby");
  });
});

describe("generic alert vs detailed alert use the same list", () => {
  it("stays quiet only when the detailed alert covers every fresh incident", () => {
    expect(detailedAlertCovers([accident], { incidents: [accident], path })).toBe(true);
    // Not covered (e.g. other carriageway): the generic line must still speak.
    const west = { ...accident, road: "H-1", points: [at(22)[0]!, at(20)[0]!] };
    expect(detailedAlertCovers([west], { incidents: [west], path })).toBe(false);
    // Not an accident/closure: generic speaks.
    const jam = { ...accident, id: "j", category: "6" };
    expect(detailedAlertCovers([jam], { incidents: [jam], path })).toBe(false);
    // Fresh in the old list but missing from the navigation list: generic speaks.
    expect(detailedAlertCovers([accident], { incidents: [], path })).toBe(false);
    expect(detailedAlertCovers([], { incidents: [accident], path })).toBe(false);
  });
});

describe("nearbyIncidentFrom (server side)", () => {
  const props = {
    id: "n1",
    iconCategory: 1,
    roadNumbers: ["H1 E"],
    from: "Aiea",
    to: "Halawa",
    delay: 540,
    events: [{ description: "Accident" }],
  };
  it("keeps a categorised incident with a place, flagging whether it is on the route", () => {
    const near = nearbyIncidentFrom(props, at(20, 0.005), path); // ~550 m north
    expect(near).toMatchObject({
      id: "n1",
      category: "1",
      road: "H-1 East",
      delayMinutes: 9,
      onRoute: false,
    });
    const on = nearbyIncidentFrom(props, at(20), path);
    expect(on?.onRoute).toBe(true);
  });
  it("drops incidents far away, without a category, or without a place", () => {
    expect(nearbyIncidentFrom(props, at(20, 0.05), path)).toBeNull();
    expect(nearbyIncidentFrom({ ...props, iconCategory: 0 }, at(20), path)).toBeNull();
    const { from: _from, roadNumbers: _roads, ...noPlace } = props;
    expect(nearbyIncidentFrom(noPlace, at(20), path)).toBeNull();
  });
});

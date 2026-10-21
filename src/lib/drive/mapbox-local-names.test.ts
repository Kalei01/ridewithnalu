import { describe, expect, it } from "vitest";
import { extractCorridor, type GuidanceInstruction } from "./corridor";
import { parseMapboxRoute } from "./mapbox-directions";
import { localRoadName } from "../traffic-incidents";
import { localizeInstruction } from "../local-directions";

// Step names, refs and wording captured from the live deployed server function
// (Mapbox fallback, Oct 21 2026). Distances are approximate; locations are placeholders on a line.
type S = { n: string; ref?: string; d: number; type?: string; mod?: string; text: string };
function route(steps: S[]) {
  const coordinates = steps.map((_, i) => [-158 + i * 0.01, 21.33] as [number, number]);
  return parseMapboxRoute({
    code: "Ok",
    routes: [
      {
        duration: 1800,
        distance: steps.reduce((a, s) => a + s.d, 0),
        geometry: { coordinates },
        legs: [
          {
            steps: steps.map((s, i) => ({
              distance: s.d,
              name: s.n,
              ...(s.ref ? { ref: s.ref } : {}),
              maneuver: {
                location: coordinates[i]!,
                type: s.type ?? "turn",
                modifier: s.mod ?? "left",
                instruction: s.text,
              },
            })),
          },
        ],
      },
    ],
  })!;
}
const corridorOf = (r: ReturnType<typeof route>, lon: [number, number]) =>
  extractCorridor(
    r.instructions.map((i): GuidanceInstruction => ({
      routeOffsetInMeters: i.routeOffsetInMeters,
      street: i.nextRoadInformation.streetName?.text ?? "",
      roadNumbers: (i.nextRoadInformation.roadShields ?? []).map((x) => x.roadNumber.text),
      maneuver: i.maneuver,
    })),
    r.meters,
    { fromLon: lon[0], toLon: lon[1] },
  );

describe("local road names for Mapbox routes", () => {
  it("maps provider freeway refs and official names to local ones", () => {
    expect(localRoadName("I H1")).toBe("H-1");
    expect(localRoadName("I-H1")).toBe("H-1");
    expect(localRoadName("I H2 South")).toBe("H-2 South");
    expect(localRoadName("I H3")).toBe("H-3");
    expect(localRoadName("H201")).toBe("Moanalua Fwy");
    expect(localRoadName("Queen Liliʻuokalani Fwy East")).toBe("H-1 East");
    expect(localRoadName("Lunalilo Fwy West")).toBe("H-1 West");
    expect(localRoadName("John A. Burns Fwy")).toBe("H-3");
    expect(localRoadName("Moanalua Fwy East")).toBe("Moanalua Fwy East");
    expect(localRoadName("Kalanianaʻole Hwy")).toBe("Kalanianaʻole Hwy");
  });

  it("collapses spelling variants and fixes the okina", () => {
    expect(localRoadName("Kalākaua Avenue; Kalakaua Avenue")).toBe("Kalākaua Avenue");
    expect(localRoadName("Pali Hwy; Kailua Rd")).toBe("Pali Hwy; Kailua Rd");
    expect(localRoadName("Hawai’i Kai Drive")).toBe("Hawaiʻi Kai Drive");
    expect(localRoadName("Kaniana’ole Highway")).toBe("Kanianaʻole Hwy");
  });

  it("localizes spoken text", () => {
    expect(localizeInstruction("Continue on I H1.")).toBe("Continue on H-1.");
    expect(localizeInstruction("Keep right to take I H1 East toward Waikiki/Honolulu.")).toBe(
      "Keep right to take H-1 East toward Waikiki/Honolulu.",
    );
    expect(
      localizeInstruction(
        "Turn left onto Kalākaua Avenue/Kalakaua Avenue. Continue on Kalākaua Avenue.",
      ),
    ).toBe("Turn left onto Kalākaua Avenue. Continue on Kalākaua Avenue.");
    expect(localizeInstruction("Turn right onto HI 72/Kalaniana’ole Highway.")).toBe(
      "Turn right onto HI 72/Kalanianaʻole Highway.",
    );
  });

  it("Kapolei → Downtown: no H-3 stub, no duplicate H-1", () => {
    const r = route([
      { n: "Manawai Street", d: 400, text: "Turn right onto Manawai Street." },
      {
        n: "Queen Liliʻuokalani Fwy",
        ref: "I H1",
        d: 24000,
        type: "on ramp",
        mod: "slight right",
        text: "Merge onto I H1 East.",
      },
      {
        n: "John A. Burns Fwy",
        ref: "I H3",
        d: 1200,
        type: "fork",
        text: "Keep left to take I H3 toward Kaneohe/Honolulu.",
      },
      {
        n: "Moanalua Fwy",
        d: 4500,
        type: "new name",
        mod: "straight",
        text: "Continue on Moanalua Fwy.",
      },
      { n: "", ref: "I H1", d: 5000, type: "merge", text: "Continue on I H1." },
      { n: "North King Street", d: 900, text: "Turn left onto North King Street." },
    ]);
    const c = corridorOf(r, [-158.079, -157.8618])!;
    expect(c.label).toBe("Via H-1 East → Moanalua Fwy East → North King Street");
    expect(c.label).not.toMatch(/H-3|Burns/);
  });

  it("Airport → Waikiki: duplicate spelling shown once", () => {
    const r = route([
      { n: "Rodgers Boulevard", d: 1500, text: "Bear right onto Rodgers Boulevard." },
      {
        n: "Queen Liliʻuokalani Fwy",
        ref: "I H1",
        d: 9000,
        type: "fork",
        text: "Keep right to take I H1 East.",
      },
      { n: "South Beretania Street", d: 2500, text: "Turn right onto South Beretania Street." },
      {
        n: "Kalākaua Avenue; Kalakaua Avenue",
        d: 3500,
        text: "Turn left onto Kalākaua Avenue/Kalakaua Avenue.",
      },
    ]);
    const c = corridorOf(r, [-157.921, -157.8292])!;
    expect(c.label).toBe(
      "Via Rodgers Boulevard → H-1 East → South Beretania Street → Kalākaua Avenue",
    );
    expect(r.instructions[3]!.instructionMessage).toBe("Turn left onto Kalākaua Avenue.");
  });

  it("Mililani → Downtown: H-2 from the ref", () => {
    const r = route([
      { n: "Kuahelani Avenue", d: 600, text: "Turn right onto Kuahelani Avenue." },
      { n: "I H2 South", d: 12000, text: "Merge onto I H2 South." },
      { n: "Moanalua Fwy", d: 9000, text: "Continue on Moanalua Fwy." },
      { n: "North King Street", d: 900, text: "Turn left onto North King Street." },
    ]);
    expect(corridorOf(r, [-158.0153, -157.8618])!.label).toBe(
      "Via H-2 South → Moanalua Fwy East → North King Street",
    );
  });

  it("Kailua → Downtown: one merged minor street over a long drive gets no label", () => {
    const r = route([
      { n: "Kuulei Road", d: 21000, text: "Turn left onto Kuulei Road." },
      { n: "South Beretania Street", d: 1200, text: "Turn right onto South Beretania Street." },
      { n: "South King Street", d: 600, text: "Turn left onto South King Street." },
    ]);
    expect(corridorOf(r, [-157.7397, -157.8618])).toBeNull();
  });

  it("Hawaiʻi Kai → UH: okina spelled right", () => {
    const r = route([
      { n: "Hawai’i Kai Drive", d: 2500, text: "Turn left onto Hawai’i Kai Drive." },
      { n: "Kalanianaʻole Hwy", d: 9000, text: "Turn right onto HI 72/Kalaniana’ole Highway." },
      { n: "University Avenue", d: 3000, text: "Keep left to take University Avenue." },
    ]);
    const c = corridorOf(r, [-157.709, -157.817])!;
    expect(c.label).toBe("Via Hawaiʻi Kai Drive → Kalanianaʻole Hwy → University Avenue");
  });
});

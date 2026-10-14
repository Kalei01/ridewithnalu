import { describe, expect, it } from "vitest";
import { SEASONS, activeNotes, activeSeason, seasonGreeting, type Season } from "./seasons";

/** An instant from a Honolulu clock time (Hawaiʻi is UTC-10 all year). */
const hst = (iso: string) => new Date(`${iso}-10:00`);

const test: Season = {
  id: "test",
  name: "Test",
  start: "10-24",
  end: "10-31",
  afterglowDays: 5,
  accent: { color: "#fff", soft: "#000" },
  motif: "",
  greetings: ["on-a", "on-b"],
  afterGreetings: ["after"],
  notes: [
    {
      text: "King St closed Sat 4 PM – 11 PM",
      from: "2026-10-17T16:00:00-10:00",
      until: "2026-10-17T23:00:00-10:00",
      source: "example",
    },
  ],
};
const newYear: Season = {
  ...test,
  id: "ny",
  start: "12-31",
  end: "01-01",
  afterglowDays: 5,
  notes: [],
};

describe("activeSeason", () => {
  it("ships Halloween, Oct 24-31 with a 5 day afterglow", () => {
    expect(SEASONS.map((s) => s.id)).toEqual(["halloween"]);
    expect(activeSeason(hst("2026-10-24T00:00:00"))?.phase).toBe("on");
    expect(activeSeason(hst("2026-10-31T23:59:00"))?.phase).toBe("on");
    expect(activeSeason(hst("2026-11-05T12:00:00"))?.phase).toBe("afterglow");
  });

  it("uses Honolulu dates, not UTC", () => {
    // 9 PM Oct 23 in Honolulu is already Oct 24 in UTC: still not the season.
    expect(activeSeason(hst("2026-10-23T21:00:00"))).toBeNull();
    // 11:30 PM Oct 31 in Honolulu is Nov 1 in UTC: still the last day.
    expect(activeSeason(hst("2026-10-31T23:30:00"))?.phase).toBe("on");
  });

  it("runs the afterglow for exactly afterglowDays, then stops", () => {
    expect(activeSeason(hst("2026-11-01T00:00:00"), [test])?.phase).toBe("afterglow");
    expect(activeSeason(hst("2026-11-05T23:59:00"), [test])?.phase).toBe("afterglow");
    expect(activeSeason(hst("2026-11-06T00:00:00"), [test])).toBeNull();
  });

  it("is null outside every range", () => {
    for (const d of ["2026-01-15", "2026-06-11", "2026-10-23", "2026-11-06", "2026-12-25"]) {
      expect(activeSeason(hst(`${d}T12:00:00`))).toBeNull();
    }
  });

  it("handles the year rollover (Dec 31 to Jan 1 and its afterglow)", () => {
    expect(activeSeason(hst("2026-12-30T12:00:00"), [newYear])).toBeNull();
    expect(activeSeason(hst("2026-12-31T00:00:00"), [newYear])?.phase).toBe("on");
    expect(activeSeason(hst("2027-01-01T23:00:00"), [newYear])?.phase).toBe("on");
    expect(activeSeason(hst("2027-01-02T00:00:00"), [newYear])?.phase).toBe("afterglow");
    expect(activeSeason(hst("2027-01-06T12:00:00"), [newYear])?.phase).toBe("afterglow");
    expect(activeSeason(hst("2027-01-07T00:00:00"), [newYear])).toBeNull();
  });

  it("lets the next season override a previous afterglow", () => {
    const early: Season = { ...test, id: "early", start: "10-20", end: "10-22", afterglowDays: 5 };
    const next: Season = { ...test, id: "next", start: "10-24", end: "10-31" };
    expect(activeSeason(hst("2026-10-23T12:00:00"), [early, next])?.season.id).toBe("early");
    expect(activeSeason(hst("2026-10-24T12:00:00"), [early, next])).toMatchObject({
      season: { id: "next" },
      phase: "on",
    });
  });
});

describe("seasonGreeting", () => {
  it("uses the holiday lines while on and the after-the-day line in the afterglow", () => {
    const on = activeSeason(hst("2026-10-25T08:00:00"), [test])!;
    expect(["on-a", "on-b"]).toContain(seasonGreeting(on, hst("2026-10-25T08:00:00")));
    const after = activeSeason(hst("2026-11-03T08:00:00"), [test])!;
    expect(seasonGreeting(after, hst("2026-11-03T08:00:00"))).toBe("after");
  });

  it("gives no line when the afterglow has none, and the same line all day", () => {
    const quiet: Season = { ...test, afterGreetings: [] };
    const after = activeSeason(hst("2026-11-03T08:00:00"), [quiet])!;
    expect(seasonGreeting(after, hst("2026-11-03T08:00:00"))).toBeNull();
    const on = activeSeason(hst("2026-10-25T06:00:00"), [test])!;
    expect(seasonGreeting(on, hst("2026-10-25T06:00:00"))).toBe(
      seasonGreeting(on, hst("2026-10-25T22:00:00")),
    );
  });

  it("never says Happy Halloween after the day", () => {
    for (const s of SEASONS[0]!.afterGreetings) expect(s).not.toMatch(/happy halloween/i);
  });
});

describe("activeNotes", () => {
  it("shows a note exactly inside its own window, to the hour", () => {
    expect(activeNotes(hst("2026-10-17T15:59:00"), [test])).toHaveLength(0);
    expect(activeNotes(hst("2026-10-17T16:00:00"), [test])).toHaveLength(1);
    expect(activeNotes(hst("2026-10-17T22:59:00"), [test])).toHaveLength(1);
    expect(activeNotes(hst("2026-10-17T23:00:00"), [test])).toHaveLength(0);
  });

  it("works before the season starts and after it ends", () => {
    // Oct 17 is before the Oct 24 start: no season, yet the note shows.
    expect(activeSeason(hst("2026-10-17T17:00:00"), [test])).toBeNull();
    expect(activeNotes(hst("2026-10-17T17:00:00"), [test])).toHaveLength(1);
    // Inside the season but outside the note's window: nothing.
    expect(activeNotes(hst("2026-10-26T17:00:00"), [test])).toHaveLength(0);
  });

  it("ships no practical notes until an official source is checked", () => {
    expect(SEASONS.flatMap((s) => s.notes)).toEqual([]);
  });
});

describe("season motifs", () => {
  it("are inert inline SVG (rendered with dangerouslySetInnerHTML)", () => {
    for (const s of SEASONS) {
      expect(s.motif.trim().startsWith("<svg") || s.motif === "").toBe(true);
      expect(s.motif).not.toMatch(/<script|\son\w+\s*=|href\s*=|javascript:|<foreignObject|<image|<use/i);
    }
  });
});

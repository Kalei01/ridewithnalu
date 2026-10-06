import { describe, expect, it } from "vitest";
import {
  etaText,
  etaUrl,
  parseSharedDestination,
  sharedTripPreview,
  shareText,
  shareUrl,
} from "./share-trip";
import { GUIDES, TRIP_GUIDES } from "@/components/guides/guides";

describe("sharing a trip", () => {
  it("writes a plain message with the margin and times", () => {
    expect(
      shareText({ verdict: "transit", transitLabel: "Skyline", destination: "Ala Moana", minutesFaster: 12, leaveSeconds: 6 * 3600 + 40 * 60, arriveSeconds: 7 * 3600 + 25 * 60 }),
    ).toMatch(/^Skyline beats driving by 12 min to Ala Moana right now\. Leave by 6:40.* to arrive about 7:25/);
  });

  it("doesn't claim a tiny margin", () => {
    expect(shareText({ verdict: "drive", transitLabel: "Bus", destination: "UH", minutesFaster: 1, leaveSeconds: null, arriveSeconds: null })).toBe(
      "Driving is the way to UH right now.",
    );
  });

  it("links to Nalu with or without a destination", () => {
    expect(shareUrl(null)).toBe("https://ridenalu.com/?ref=share");
    const url = shareUrl({ lat: 21.29114, lon: -157.84301, name: "Ala Moana Center" });
    expect(url).toContain("to=21.2911%2C-157.8430");
    expect(parseSharedDestination(new URL(url).search)).toEqual({ lat: 21.2911, lon: -157.843, name: "Ala Moana Center" });
  });

  it("ignores links that aren't on Oʻahu or are malformed", () => {
    expect(parseSharedDestination("?to=37.7749,-122.4194&name=SF")).toBeNull();
    expect(parseSharedDestination("?to=hello")).toBeNull();
    expect(parseSharedDestination("?to=21.3,-157.85&name=<b>x</b>")?.name).toBe("bx/b");
  });

  it("writes an ETA message with no location in it", () => {
    expect(etaText("Work", "drive", 7 * 3600 + 5 * 60)).toMatch(/^On my way to Work\. Driving, arriving about 7:05/);
  });
});

describe("share rounding", () => {
  it("rounds the margin to whole minutes", () => {
    expect(shareText({ verdict: "drive", transitLabel: "Bus", destination: "Ala Moana Center", minutesFaster: 56.38, leaveSeconds: null, arriveSeconds: null })).toBe(
      "Driving beats bus by 56 min to Ala Moana Center right now.",
    );
  });
});

describe("link previews", () => {
  it("names the trip for a link to a place, without a live answer that would go stale", () => {
    const preview = sharedTripPreview({
      ref: "share",
      to: "21.2911,-157.8430",
      name: "Ala Moana Center",
    });
    expect(preview?.title).toBe("Drive, TheBus or Skyline to Ala Moana Center?");
    expect(preview?.description).not.toMatch(/\d+ min|beats/);
  });

  it("keeps the normal preview for plain links, off-island places and missing names", () => {
    expect(sharedTripPreview({ ref: "share" })).toBeNull();
    expect(sharedTripPreview(undefined)).toBeNull();
    expect(sharedTripPreview({ to: "40.7128,-74.0060", name: "New York" })).toBeNull();
    expect(sharedTripPreview({ to: "21.2911,-157.8430" })).toBeNull();
  });

  it("drops markup from a name in a link", () => {
    expect(sharedTripPreview({ to: "21.2911,-157.8430", name: "<b>Ala Moana</b>" })?.title).toBe(
      "Drive, TheBus or Skyline to bAla Moana/b?",
    );
  });
});

describe("ETA messages", () => {
  it("carry a plain Nalu link with no place or location in it", () => {
    expect(etaUrl()).toBe("https://ridenalu.com/?ref=eta");
  });
});

describe("guides linked from the main pages", () => {
  it("are real guides", () => {
    for (const slug of TRIP_GUIDES) expect(GUIDES[slug].path).toMatch(/^\/guides\//);
  });
});

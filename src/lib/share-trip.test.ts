import { describe, expect, it } from "vitest";
import { etaText, parseSharedDestination, shareText, shareUrl } from "./share-trip";

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

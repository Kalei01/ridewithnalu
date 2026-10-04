import { describe, expect, it } from "vitest";
import { pickBestVoice } from "./best-voice";

const v = (name: string, lang = "en-US") => ({ name, lang, localService: true, default: false });

describe("pickBestVoice", () => {
  it("prefers an iPhone premium voice over the default", () => {
    const voices = [v("Fred"), v("Samantha"), v("Ava (Premium)"), v("Ava (Enhanced)")];
    expect(pickBestVoice(voices)?.name).toBe("Ava (Premium)");
  });
  it("prefers Google and Edge natural voices", () => {
    expect(pickBestVoice([v("Microsoft David"), v("Google US English")])?.name).toBe("Google US English");
    expect(pickBestVoice([v("Google US English"), v("Microsoft Aria Online (Natural) - English (United States)")])?.name)
      .toContain("Aria");
  });
  it("never picks a joke voice or a non-English voice", () => {
    expect(pickBestVoice([v("Zarvox"), v("Bad News"), v("Amélie", "fr-CA")])).toBeNull();
  });
  it("prefers US English over other English", () => {
    expect(pickBestVoice([v("Daniel", "en-GB"), v("Samantha")])?.name).toBe("Samantha");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./approach", () => ({ audioContext: () => null }));

type FakeUtterance = {
  text: string;
  voice: unknown;
  onstart?: () => void;
  onend?: () => void;
  onerror?: (event: { error: string }) => void;
};

function setup(startsWithVoice: boolean) {
  const spoken: FakeUtterance[] = [];
  const premium = { name: "Ava (Premium)", lang: "en-US", localService: true, default: false };
  const synth = {
    getVoices: () => [premium],
    addEventListener: () => {},
    resume: () => {},
    cancel: () => {},
    speak: (u: FakeUtterance) => {
      spoken.push(u);
      if (!u.voice || startsWithVoice) u.onstart?.();
    },
  };
  class Utterance {
    voice: unknown = null;
    constructor(public text: string) {}
  }
  vi.stubGlobal("window", { speechSynthesis: synth, SpeechSynthesisUtterance: Utterance, setTimeout });
  return { spoken, premium };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.resetModules();
});

describe("spoken alerts", () => {
  it("uses the best voice when it speaks", async () => {
    vi.useFakeTimers();
    const { spoken, premium } = setup(true);
    const { speakCommuteAlert } = await import("./commute-alerts");
    speakCommuteAlert("Turn right");
    vi.advanceTimersByTime(3000);
    expect(spoken).toHaveLength(1);
    expect(spoken[0]?.voice).toBe(premium);
  });

  it("falls back to the phone's default voice when the chosen one stays silent", async () => {
    vi.useFakeTimers();
    const { spoken } = setup(false);
    const { speakCommuteAlert } = await import("./commute-alerts");
    speakCommuteAlert("Turn right");
    vi.advanceTimersByTime(3000);
    expect(spoken).toHaveLength(2);
    expect(spoken[1]?.voice).toBeNull();
    expect(spoken[1]?.text).toBe("Turn right");
    // Later alerts go straight to the default voice.
    spoken[1]?.onend?.();
    speakCommuteAlert("Turn left");
    expect(spoken[2]?.voice).toBeNull();
  });

  it("leaves the voice and accent to the iPhone owner's choice", async () => {
    vi.useFakeTimers();
    const { spoken } = setup(true);
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", maxTouchPoints: 5 });
    const { speakCommuteAlert } = await import("./commute-alerts");
    speakCommuteAlert("Turn right");
    vi.advanceTimersByTime(3000);
    expect(spoken).toHaveLength(1);
    expect(spoken[0]?.voice).toBeNull();
    expect((spoken[0] as unknown as { lang: string }).lang).toBe("en");
  });
});

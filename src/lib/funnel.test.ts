import { beforeEach, describe, expect, it, vi } from "vitest";

const recordFunnelStep = vi.fn((_arg: { data: { step: string; ref?: string } }) =>
  Promise.resolve({ ok: true }),
);
vi.mock("@/lib/funnel.functions", () => ({ recordFunnelStep }));
vi.mock("@/lib/ref-source", () => ({ captureRef: () => "home" }));

const PHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";

function setup(
  opts: { userAgent?: string; webdriver?: boolean; store?: Record<string, string> } = {},
) {
  const store: Record<string, string> = { ...opts.store };
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => void (store[k] = v),
    },
  });
  vi.stubGlobal("navigator", {
    userAgent: opts.userAgent ?? PHONE,
    webdriver: opts.webdriver ?? false,
  });
  return store;
}

const steps = () => recordFunnelStep.mock.calls.map((c) => c[0].data.step);

describe("visitor funnel recording", () => {
  beforeEach(() => {
    recordFunnelStep.mockClear();
    vi.unstubAllGlobals();
  });

  it("records each step once per phone per day, with the link tag", async () => {
    setup();
    const { funnelStep, funnelAnswer, funnelLanding } = await import("./funnel");
    funnelLanding("landed_intro");
    funnelLanding("landed_app"); // only the first landing of the day counts
    funnelStep("trip_tried");
    funnelStep("trip_tried");
    funnelAnswer(2);
    funnelAnswer(3);
    expect(steps()).toEqual(["landed_intro", "trip_tried", "answer_shown", "answer_under_5s"]);
    expect(recordFunnelStep.mock.calls[0]?.[0].data.ref).toBe("home");
  });

  it("keeps automated browsers and owner phones out", async () => {
    const { funnelStep } = await import("./funnel");
    setup({ webdriver: true });
    funnelStep("trip_tried");
    setup({ userAgent: "Mozilla/5.0 HeadlessChrome/120" });
    funnelStep("trip_tried");
    setup({ store: { "nalu-owner-device-v1": "1" } });
    funnelStep("trip_tried");
    expect(recordFunnelStep).not.toHaveBeenCalled();
  });
});

/**
 * Anonymous visitor-funnel counting (proposal P-1). Each step is counted at
 * most once per phone per day, by sending only the step name and the phone's
 * first link tag. No phone id leaves the browser for this. Automated visitors
 * are skipped, and a failure never reaches the rider.
 */
import { honoluluDateKey } from "@/lib/commute-formatting";
import { isAutomatedVisitor } from "@/lib/automated-visitor";
import { captureRef } from "@/lib/ref-source";
import { recordFunnelStep } from "@/lib/funnel.functions";
import { answerSpeedStep, type FunnelStep } from "@/lib/funnel-steps";

const KEY = "nalu-funnel-day-v1";
const OWNER_KEY = "nalu-owner-device-v1";

type Seen = { day: string; steps: string[] };

function readSeen(day: string): Seen {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as Seen | null;
    if (parsed && parsed.day === day && Array.isArray(parsed.steps)) return parsed;
  } catch {
    /* private mode or bad data: start fresh */
  }
  return { day, steps: [] };
}

/** Counts `step` once for this phone today. Safe to call from anywhere in the browser. */
export function funnelStep(step: FunnelStep) {
  if (typeof window === "undefined") return;
  try {
    if (isAutomatedVisitor({ userAgent: navigator.userAgent, webdriver: navigator.webdriver }))
      return;
    if (window.localStorage.getItem(OWNER_KEY) === "1") return;
    const day = honoluluDateKey(new Date());
    const seen = readSeen(day);
    if (seen.steps.includes(step)) return;
    seen.steps.push(step);
    window.localStorage.setItem(KEY, JSON.stringify(seen));
    const ref = captureRef();
    void recordFunnelStep({ data: { step, ...(ref ? { ref } : {}) } }).catch(() => undefined);
  } catch {
    /* counting never gets in the way */
  }
}

/** Where the rider landed first today: only the first landing of the day counts. */
export function funnelLanding(step: FunnelStep) {
  try {
    const seen = readSeen(honoluluDateKey(new Date()));
    if (seen.steps.some((s) => s.startsWith("landed_"))) return;
  } catch {
    /* fall through to the normal once-a-day check */
  }
  funnelStep(step);
}

/** Counts that an answer appeared, and how quickly (under 5 s, 5-10 s, over 10 s). */
export function funnelAnswer(seconds: number) {
  funnelStep("answer_shown");
  funnelStep(answerSpeedStep(seconds));
}

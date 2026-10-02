import { audioContext } from "./approach";
import { VoicePriorityQueue, type VoicePriority } from "./voice-priority-queue";

export type TrafficAlertSnapshot = {
  delayMinutes: number;
  incidentKeys: string[];
};

export type TrafficAlertChange =
  { kind: "delay"; increaseMinutes: number } | { kind: "incident" } | null;

/** Compare successive live refreshes without announcing the initial snapshot. */
export function detectTrafficAlert(
  previous: TrafficAlertSnapshot | null,
  current: TrafficAlertSnapshot,
  baseline: TrafficAlertSnapshot | null = previous,
): TrafficAlertChange {
  if (!previous) return null;
  // Keep gradual increases from escaping notice when each polling step is
  // smaller than the five-minute threshold.
  const increaseMinutes = current.delayMinutes - (baseline?.delayMinutes ?? previous.delayMinutes);
  if (increaseMinutes >= 5) return { kind: "delay", increaseMinutes };
  const oldIncidents = new Set(previous.incidentKeys);
  return current.incidentKeys.some((key) => !oldIncidents.has(key)) ? { kind: "incident" } : null;
}

export function requestCommuteNotificationPermission() {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (window.Notification.permission === "default")
      void window.Notification.requestPermission().catch(() => {});
  } catch {
    // Notification access is optional and must never interrupt starting a trip.
  }
}

export function postCommuteNotification(title: string, body: string, tag: string) {
  try {
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      window.Notification.permission !== "granted"
    )
      return;
    new window.Notification(title, { body, tag });
  } catch {
    // Some browsers expose Notification but still block construction.
  }
}

export function speakCommuteAlert(message: string, priority: VoicePriority = "info") {
  try {
    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window) ||
      typeof window.SpeechSynthesisUtterance !== "function"
    )
      return;

    const request = { message, priority };
    const decision = speechQueue.enqueue(request);

    if (decision.action === "interrupt") {
      speechGeneration += 1;
      window.speechSynthesis.cancel();
      speakQueuedRequest(decision.request);
      return;
    }

    if (decision.action === "start") speakQueuedRequest(decision.request);
  } catch {
    // Speech is best-effort on browsers that suspend audio in the background.
  }
}

const speechQueue = new VoicePriorityQueue();
let speechGeneration = 0;

function speakQueuedRequest(request: { message: string; priority: VoicePriority }) {
  const generation = ++speechGeneration;

  try {
    const utterance = new window.SpeechSynthesisUtterance(request.message);
    utterance.lang = "en-US";
    utterance.rate = 0.94;
    utterance.volume = 1;

    const finish = () => {
      if (generation !== speechGeneration) return;
      const next = speechQueue.finish(request);
      if (next) speakQueuedRequest(next);
    };

    utterance.onend = finish;
    utterance.onerror = finish;

    // Wake the car's Bluetooth audio route first so the first syllable isn't
    // swallowed, then speak once the primer has finished.
    const primed = playAudioPrimer();
    const speak = () => {
      try {
        if (generation !== speechGeneration || speechQueue.getActive() !== request) return;
        window.speechSynthesis.resume();
        window.speechSynthesis.speak(utterance);
      } catch {
        finish();
      }
    };
    if (primed) window.setTimeout(speak, PRIMER_MS);
    else speak();
  } catch {
    if (generation === speechGeneration) {
      const next = speechQueue.finish(request);
      if (next) speakQueuedRequest(next);
    }
  }
}

/** Cancel current/pending spoken alerts without affecting navigation state. */
export function clearCommuteSpeech() {
  try {
    speechGeneration += 1;
    speechQueue.clear();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  } catch {
    // Best-effort only.
  }
}


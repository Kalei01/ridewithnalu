import { audioContext } from "./approach";

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

export function speakCommuteAlert(message: string) {
  try {
    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window) ||
      typeof window.SpeechSynthesisUtterance !== "function"
    )
      return;
    const utterance = new window.SpeechSynthesisUtterance(message);
    utterance.lang = "en-US";
    utterance.rate = 0.94;
    utterance.volume = 1;
    window.speechSynthesis.cancel();
    // Wake the car's Bluetooth audio route first so the first syllable isn't
    // swallowed, then speak once the primer has finished.
    const primed = playAudioPrimer();
    const speak = () => {
      try {
        window.speechSynthesis.resume();
        window.speechSynthesis.speak(utterance);
      } catch {
        // best-effort
      }
    };
    if (primed) window.setTimeout(speak, PRIMER_MS);
    else speak();
  } catch {
    // Speech is best-effort on browsers that suspend audio in the background.
  }
}

/** Speak a silent utterance inside a user tap so iOS Safari unlocks speech. */
export function primeSpeech() {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const utterance = new window.SpeechSynthesisUtterance(" ");
    utterance.volume = 0;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Best-effort only.
  }
}

export const PRIMER_MS = 300;

/** A soft 300ms tone that opens the Bluetooth/car audio channel before speech. */
export function playAudioPrimer(): boolean {
  try {
    const ctx = audioContext();
    if (!ctx) return false;
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 988;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + PRIMER_MS / 1000);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + PRIMER_MS / 1000 + 0.02);
    return true;
  } catch {
    return false;
  }
}

/**
 * Keep audio alive for the whole navigation session: an inaudible oscillator
 * stops iOS Safari suspending the audio context, and a periodic resume()
 * works around speechSynthesis stalling mid-drive. Returns a stop function.
 */
export function keepNavigationAudioAlive(): () => void {
  let osc: OscillatorNode | null = null;
  let timer: number | null = null;
  try {
    const ctx = audioContext();
    if (ctx) {
      if (ctx.state === "suspended") void ctx.resume();
      osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
    }
    timer = window.setInterval(() => {
      try {
        if (ctx && ctx.state === "suspended") void ctx.resume();
        if ("speechSynthesis" in window && !window.speechSynthesis.speaking)
          window.speechSynthesis.resume();
      } catch {
        // best-effort
      }
    }, 10_000);
  } catch {
    // best-effort
  }
  return () => {
    try {
      osc?.stop();
      osc?.disconnect();
    } catch {
      // already stopped
    }
    if (timer !== null) window.clearInterval(timer);
  };
}

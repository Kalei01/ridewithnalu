import { audioContext } from "./approach";
import { bestVoice, isAppleMobile } from "./best-voice";
import { debugLog } from "./debug-log";
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

/**
 * `immediate` speaks right away with no warm-up chime. Use it inside a tap:
 * iPhones only let a web app start talking during a tap, and a delay breaks that.
 */
export function speakCommuteAlert(
  message: string,
  priority: VoicePriority = "info",
  options: { immediate?: boolean } = {},
) {
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
      speakQueuedRequest(decision.request, options.immediate === true);
      return;
    }

    if (decision.action === "start") speakQueuedRequest(decision.request, options.immediate === true);
  } catch {
    // Speech is best-effort on browsers that suspend audio in the background.
  }
}

const speechQueue = new VoicePriorityQueue();
let speechGeneration = 0;
// Set when a chosen voice fails to speak on this phone; from then on the
// phone's default voice is used, which always worked.
let useDefaultVoice = false;
const VOICE_START_TIMEOUT_MS = 2500;

function speakQueuedRequest(request: { message: string; priority: VoicePriority }, immediate = false) {
  const generation = ++speechGeneration;
  debugLog("speech", { phase: "request", priority: request.priority, chars: request.message.length, immediate });

  try {
    const utterance = new window.SpeechSynthesisUtterance(request.message);
    const voice = useDefaultVoice ? null : bestVoice();
    if (voice) utterance.voice = voice;
    debugLog("speech", { phase: "voice", voice: voice ? voice.name : "phone default", lang: utterance.lang });
    // On iPhone, plain "en" lets the phone use the English voice and accent
    // its owner picked in Settings; "en-US" would force a US voice.
    utterance.lang = !voice && isAppleMobile() ? "en" : (voice?.lang ?? "en-US");
    utterance.rate = 0.94;
    utterance.volume = 1;
    let started = false;

    const finish = () => {
      if (generation !== speechGeneration) return;
      const next = speechQueue.finish(request);
      if (next) speakQueuedRequest(next);
    };
    // The chosen voice didn't speak: say the same thing again in the default voice.
    const retryWithDefault = () => {
      if (generation !== speechGeneration || started) return;
      useDefaultVoice = true;
      speechGeneration += 1;
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* nothing to cancel */
      }
      speakQueuedRequest(request);
    };

    utterance.onstart = () => {
      started = true;
      debugLog("speech", { phase: "start", priority: request.priority });
    };
    utterance.onend = () => {
      debugLog("speech", { phase: "end", priority: request.priority, started });
      finish();
    };
    utterance.onerror = (event) => {
      const reason = (event as SpeechSynthesisErrorEvent | undefined)?.error;
      debugLog("speech", { phase: "error", priority: request.priority, error: reason ?? "unknown", started });
      if (voice && !started && reason !== "interrupted" && reason !== "canceled") retryWithDefault();
      else finish();
    };

    const primed = immediate ? false : playAudioPrimer();
    const speak = () => {
      try {
        if (generation !== speechGeneration || speechQueue.getActive() !== request) return;
        window.speechSynthesis.resume();
        window.speechSynthesis.speak(utterance);
        if (voice) window.setTimeout(retryWithDefault, VOICE_START_TIMEOUT_MS);
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

/** Speak a silent utterance inside a user tap so iOS Safari unlocks speech. */
export function primeSpeech() {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    // Ask for the voice list now, so the first real alert already has it.
    bestVoice();
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

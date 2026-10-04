/**
 * Picks the most natural English voice the phone already has. Without this
 * the browser uses its default, which is often its oldest, flattest voice,
 * while the same phone usually has far better ones installed.
 */
type VoiceLike = Pick<SpeechSynthesisVoice, "name" | "lang" | "localService" | "default">;

// Joke and legacy voices that ship on Apple devices and sound robotic.
const NOVELTY =
  /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|fred|good news|hysterical|jester|junior|kathy|organ|ralph|superstar|trinoids|whisper|wobble|zarvox|grandma|grandpa|eddy|flo|reed|rocko|sandy|shelley)\b/i;

export function voiceScore(voice: VoiceLike): number {
  const lang = voice.lang.replace("_", "-").toLowerCase();
  if (!lang.startsWith("en")) return -1;
  const name = voice.name;
  if (NOVELTY.test(name)) return 0;
  let score = 10;
  if (lang === "en-us") score += 20;
  else if (lang === "en-gb" || lang === "en-au") score += 8;
  // Apple's downloaded high-quality voices, Edge's neural voices.
  if (/\bpremium\b/i.test(name)) score += 60;
  else if (/\benhanced\b/i.test(name)) score += 45;
  if (/\bnatural\b|\bneural\b/i.test(name)) score += 50;
  // Chrome's and Android's Google voices.
  if (/\bgoogle\b/i.test(name)) score += 35;
  // Apple voices that sound good even in their standard form.
  if (/\b(ava|zoe|evan|nathan|allison|susan|tom|samantha)\b/i.test(name)) score += 15;
  // Older Windows desktop voices.
  if (/\bmicrosoft (david|zira|mark)\b/i.test(name)) score -= 5;
  return score;
}

export function pickBestVoice<T extends VoiceLike>(voices: readonly T[]): T | null {
  let best: T | null = null;
  let bestScore = 0;
  for (const voice of voices) {
    const score = voiceScore(voice);
    if (score > bestScore) {
      best = voice;
      bestScore = score;
    }
  }
  return best;
}

let cached: SpeechSynthesisVoice | null = null;
let listening = false;

/**
 * iPhone and iPad can report a chosen voice as speaking while no sound comes
 * out, so on Apple devices Nalu keeps the phone's own voice, which always works.
 */
function isAppleMobile() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);
}

/** The best voice available right now, or null to let the phone decide. */
export function bestVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  if (isAppleMobile()) return null;
  const synth = window.speechSynthesis;
  if (!listening) {
    listening = true;
    // Many browsers list their voices only after a moment.
    synth.addEventListener?.("voiceschanged", () => {
      try {
        cached = pickBestVoice(synth.getVoices());
      } catch {
        /* keep the previous choice */
      }
    });
  }
  if (!cached) {
    try {
      cached = pickBestVoice(synth.getVoices?.() ?? []);
    } catch {
      cached = null;
    }
  }
  return cached;
}

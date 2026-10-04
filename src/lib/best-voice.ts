/**
 * Picks the most natural English voice the phone already has. Without this
 * the browser uses its default, which is often its oldest, flattest voice,
 * while the same phone usually has far better ones installed.
 */
type VoiceLike = Pick<SpeechSynthesisVoice, "name" | "lang" | "localService" | "default">;

// Joke and legacy voices that ship on Apple devices and sound robotic.
const NOVELTY =
  /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|fred|good news|hysterical|jester|junior|kathy|organ|ralph|superstar|trinoids|whisper|wobble|zarvox|grandma|grandpa|eddy|flo|reed|rocko|sandy|shelley)\b/i;

export function isNoveltyVoice(name: string) {
  return NOVELTY.test(name);
}

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
 * iPhone and iPad users choose their own English voice and accent in
 * Settings, so Nalu leaves the choice to the phone there.
 */
export function isAppleMobile() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent ?? "";
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Mac") && (navigator.maxTouchPoints ?? 0) > 1);
}

/** The voice to use right now: the one picked in Settings, else Nalu's pick, else null for the phone's own. */
export function bestVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const chosen = findChosenVoice(safeVoices());
  if (chosen) return chosen;
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

const CHOICE_KEY = "nalu-voice-v1";

/** The voice picked in Settings (its id), or null for automatic. */
export function readVoiceChoice(): string | null {
  try {
    return window.localStorage.getItem(CHOICE_KEY);
  } catch {
    return null;
  }
}

const LABEL_KEY = "nalu-voice-label-v1";

/** A short label for the chosen voice, like "Daniel · British", for the Settings list. */
export function readVoiceLabel(): string | null {
  try {
    return window.localStorage.getItem(CHOICE_KEY) ? window.localStorage.getItem(LABEL_KEY) : null;
  } catch {
    return null;
  }
}

export function writeVoiceChoice(id: string | null, label: string | null = null) {
  try {
    if (id) window.localStorage.setItem(CHOICE_KEY, id);
    else window.localStorage.removeItem(CHOICE_KEY);
    if (id && label) window.localStorage.setItem(LABEL_KEY, label);
    else window.localStorage.removeItem(LABEL_KEY);
  } catch {
    /* private mode: the choice lasts until the app closes */
  }
}

export function voiceId(voice: Pick<SpeechSynthesisVoice, "name" | "voiceURI">) {
  return voice.voiceURI || voice.name;
}

export function findChosenVoice<T extends Pick<SpeechSynthesisVoice, "name" | "voiceURI">>(
  voices: readonly T[],
  id = typeof window === "undefined" ? null : readVoiceChoice(),
): T | null {
  if (!id) return null;
  return voices.find((voice) => voiceId(voice) === id) ?? voices.find((voice) => voice.name === id) ?? null;
}

export function safeVoices(): SpeechSynthesisVoice[] {
  try {
    return window.speechSynthesis.getVoices?.() ?? [];
  } catch {
    return [];
  }
}

const ACCENTS: Array<[RegExp, string]> = [
  [/^en[-_]us/i, "American"],
  [/^en[-_]gb[-_].*sct|scotland/i, "Scottish"],
  [/^en[-_]gb/i, "British"],
  [/^en[-_]au/i, "Australian"],
  [/^en[-_]ie/i, "Irish"],
  [/^en[-_]in/i, "Indian"],
  [/^en[-_]za/i, "South African"],
  [/^en[-_]nz/i, "New Zealand"],
  [/^en[-_]ca/i, "Canadian"],
  [/^en[-_]sg/i, "Singaporean"],
];

export function accentName(lang: string): string {
  for (const [pattern, label] of ACCENTS) if (pattern.test(lang)) return label;
  return "English";
}

/** Real English voices only, best-sounding first within each accent, American first. */
export function choosableVoices<T extends VoiceLike & Pick<SpeechSynthesisVoice, "voiceURI">>(voices: readonly T[]): T[] {
  const seen = new Set<string>();
  return voices
    .filter((voice) => voice.lang.toLowerCase().startsWith("en") && !isNoveltyVoice(voice.name))
    .filter((voice) => {
      const id = voiceId(voice);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .sort((a, b) => {
      const accentA = accentName(a.lang);
      const accentB = accentName(b.lang);
      if (accentA !== accentB) {
        if (accentA === "American") return -1;
        if (accentB === "American") return 1;
        return accentA.localeCompare(accentB);
      }
      return voiceScore(b) - voiceScore(a) || a.name.localeCompare(b.name);
    });
}

import { useEffect, useState } from "react";
import { Check, Volume2 } from "lucide-react";
import {
  accentName,
  choosableVoices,
  readVoiceChoice,
  safeVoices,
  voiceId,
  writeVoiceChoice,
} from "@/lib/best-voice";
import { clearCommuteSpeech, resetVoiceFallback, speakCommuteAlert } from "@/lib/commute-alerts";
import { cn } from "@/lib/utils";

const SAMPLE = "Starting route to Ala Moana Center. In a quarter mile, turn right.";

/** Phones list their voices a moment after asking, so keep checking briefly. */
function useVoices() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() =>
    typeof window === "undefined" ? [] : safeVoices(),
  );
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const update = () => setVoices(safeVoices());
    window.speechSynthesis.addEventListener?.("voiceschanged", update);
    const timer = window.setInterval(update, 500);
    const stop = window.setTimeout(() => window.clearInterval(timer), 8000);
    update();
    return () => {
      window.speechSynthesis.removeEventListener?.("voiceschanged", update);
      window.clearInterval(timer);
      window.clearTimeout(stop);
    };
  }, []);
  return voices;
}

/** Shortens "Daniel (Enhanced)" style names into a name and a quality tag. */
function nameAndTag(name: string) {
  const match = /^(.*?)\s*\((premium|enhanced)\)\s*$/i.exec(name);
  return match ? { name: match[1] ?? name, tag: match[2] ?? null } : { name, tag: null };
}

/**
 * One tap picks a voice and plays it, so people hear what they chose. The
 * first option leaves the choice to the phone.
 */
export function VoiceSection() {
  const voices = useVoices();
  const [chosen, setChosen] = useState<string | null>(() =>
    typeof window === "undefined" ? null : readVoiceChoice(),
  );
  const options = choosableVoices(voices);

  function pick(id: string | null, label: string | null) {
    writeVoiceChoice(id, label);
    setChosen(id);
    resetVoiceFallback();
    clearCommuteSpeech();
    speakCommuteAlert(SAMPLE, "info", { immediate: true });
  }

  const row = (id: string | null, title: string, detail: string, tag: string | null = null) => {
    const selected = chosen === id;
    return (
      <li key={id ?? "phone"}>
        <button
          type="button"
          onClick={() => pick(id, id ? `${title} · ${detail}` : null)}
          aria-pressed={selected}
          className={cn(
            "flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
            selected ? "bg-primary/12 ring-1 ring-primary/50" : "hover:bg-muted/40",
          )}
        >
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full border",
              selected ? "border-primary bg-primary text-primary-foreground" : "border-border",
            )}
            aria-hidden="true"
          >
            {selected && <Check className="size-4" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold text-foreground">
              {title}
              {tag && (
                <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 align-middle text-xs font-semibold capitalize text-primary">
                  {tag}
                </span>
              )}
            </span>
            <span className="block text-sm text-muted-foreground">{detail}</span>
          </span>
          <Volume2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </li>
    );
  };

  return (
    <div className="grid gap-3">
      <p className="text-base leading-7 text-muted-foreground">
        Tap a voice to hear it. Nalu uses it for directions and stop alerts on this phone.
      </p>
      <ul className="grid gap-1.5">
        {row(null, "Phone's voice", "Whatever your phone uses by default")}
        {options.map((voice) => {
          const { name, tag } = nameAndTag(voice.name);
          return row(voiceId(voice), name, accentName(voice.lang), tag);
        })}
      </ul>
      {options.length === 0 && (
        <p className="text-sm leading-6 text-muted-foreground">
          Your phone hasn't shared its voices yet. Tap “Phone's voice” once and the list will appear.
        </p>
      )}
      <p className="text-sm leading-6 text-muted-foreground">
        For more natural voices on iPhone, download an Enhanced or Premium voice in Settings →
        Accessibility → Read &amp; Speak → Voices → English.
      </p>
    </div>
  );
}

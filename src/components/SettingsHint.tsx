import { useEffect, useState } from "react";
import { Lightbulb } from "lucide-react";
import { markHintSeen, markHintUsed, shouldShowHint } from "@/lib/hints";
import { cn } from "@/lib/utils";

/**
 * A small, quiet pointer to a setting, placed where it matters ("Change voice"
 * on the navigation map). One tap opens that exact Settings page.
 */
export function SettingsHint({
  id,
  label,
  onOpen,
  className,
}: {
  id: string;
  label: string;
  onOpen: () => void;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!shouldShowHint(id)) return;
    setVisible(true);
    markHintSeen(id);
  }, [id]);
  if (!visible) return null;
  return (
    <button
      type="button"
      onClick={() => {
        markHintUsed(id);
        setVisible(false);
        onOpen();
      }}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-primary/30 bg-background/80 px-3 text-sm font-semibold text-primary shadow-sm backdrop-blur-md",
        className,
      )}
    >
      <Lightbulb className="size-4" aria-hidden="true" />
      {label}
    </button>
  );
}

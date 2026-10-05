import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Opens the phone's own share sheet (Messages, WhatsApp, etc.). Where that
 * isn't available, copies the message instead.
 */
export function ShareButton({
  text,
  url,
  label,
  className = "",
}: {
  text: string;
  url?: string;
  label: string;
  className?: string;
}) {
  async function share() {
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ text, ...(url ? { url } : {}) });
        return;
      } catch (error) {
        // Closing the share sheet isn't a failure.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url ? `${text} ${url}` : text);
      toast("Copied. Paste it into a message.");
    } catch {
      toast.error("Couldn't share from this browser.");
    }
  }

  return (
    <Button type="button" variant="outline" className={`h-12 gap-2 text-base ${className}`} onClick={() => void share()}>
      <Share2 className="size-4" aria-hidden="true" /> {label}
    </Button>
  );
}

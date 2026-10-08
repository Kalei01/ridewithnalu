import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { submitFeedback } from "@/lib/feedback.functions";
import { FEEDBACK_MAX, type FeedbackCategory } from "@/lib/feedback-text";

const CATEGORIES: { value: FeedbackCategory; label: string }[] = [
  { value: "wrong_answer", label: "Wrong answer" },
  { value: "idea", label: "Idea" },
  { value: "other", label: "Other" },
];

/**
 * One text box for anything riders want Nalu to know. No account or contact
 * details; the trip is attached only if the rider ticks the box, and the
 * words that would be sent are shown right there. Never shows anything back
 * but "thanks".
 */
export function TellNaluForm({
  tripNote,
  onDone,
}: {
  tripNote?: string | undefined;
  onDone?: () => void;
}) {
  const send = useServerFn(submitFeedback);
  const [category, setCategory] = useState<FeedbackCategory>(tripNote ? "wrong_answer" : "idea");
  const [message, setMessage] = useState("");
  const [includeTrip, setIncludeTrip] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);

  async function submit() {
    if (!message.trim() || sending) return;
    setSending(true);
    setFailed(false);
    try {
      await send({
        data: {
          category,
          message: message.trim(),
          ...(includeTrip && tripNote ? { tripNote } : {}),
        },
      });
      setSent(true);
      setMessage("");
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="grid gap-3 rounded-lg bg-surface-raised p-4">
        <p className="text-sm text-foreground">Mahalo, we read everything.</p>
        {onDone && (
          <Button size="sm" variant="outline" className="min-h-11 shadow-none" onClick={onDone}>
            Done
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-3 rounded-lg bg-surface-raised p-4">
      <div role="radiogroup" aria-label="What kind of note" className="flex flex-wrap gap-2">
        {CATEGORIES.map((item) => (
          <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={category === item.value}
            onClick={() => setCategory(item.value)}
            className={`min-h-11 rounded-full border px-4 text-sm transition-colors ${
              category === item.value
                ? "border-primary bg-primary/12 font-semibold text-foreground"
                : "border-border text-muted-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="tell-nalu-message">Tell Nalu something</Label>
        <Textarea
          id="tell-nalu-message"
          rows={4}
          maxLength={FEEDBACK_MAX}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className="bg-background text-base"
        />
        <p className="text-xs text-muted-foreground">
          No account needed. Please don&apos;t include your name or phone number.
        </p>
      </div>
      {tripNote && (
        <label className="flex min-h-11 items-start gap-3 text-sm text-foreground">
          <Checkbox
            checked={includeTrip}
            onCheckedChange={(value) => setIncludeTrip(value === true)}
            className="mt-0.5"
            aria-label="Include this trip"
          />
          <span>
            Include this trip
            <span className="block text-xs text-muted-foreground">Sends: {tripNote}</span>
          </span>
        </label>
      )}
      <Button
        onClick={submit}
        disabled={!message.trim() || sending}
        className="min-h-11 shadow-none"
      >
        {sending ? "Sending…" : "Send"}
      </Button>
      {failed && (
        <p className="text-xs text-muted-foreground">
          Couldn&apos;t send just now. Try again, or email hello@ridenalu.com.
        </p>
      )}
    </div>
  );
}

/** A quiet link on the trip screen that opens the form in a sheet. */
export function TellNaluLink({ tripNote }: { tripNote?: string | undefined }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mx-auto mt-4 flex min-h-11 items-center gap-2 px-3 text-sm text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
      >
        <MessageSquarePlus className="size-4" />
        Something look off? Tell Nalu
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tell Nalu something</DialogTitle>
            <DialogDescription>A wrong answer, an idea, anything.</DialogDescription>
          </DialogHeader>
          <TellNaluForm tripNote={tripNote} onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

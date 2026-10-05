import { useEffect, useId, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { getEmailOptIn, setEmailOptIn } from "@/lib/email.functions";

/** Settings: commute emails. Off until the rider turns them on; signed-in riders only. */
export function EmailOptIn() {
  const { user } = useAuth();
  const id = useId();
  const read = useServerFn(getEmailOptIn);
  const write = useServerFn(setEmailOptIn);
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user?.email) return;
    let live = true;
    void read()
      .then((r) => live && setOn(r.on))
      .catch(() => live && setOn(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (!user?.email || on === null) return null;

  async function change(next: boolean) {
    if (busy) return;
    setBusy(true);
    setOn(next);
    try {
      const result = await write({ data: { on: next } });
      setOn(result.on);
      toast(result.on ? "Emails are on." : "Emails are off.");
    } catch {
      setOn(!next);
      toast.error("Couldn't save that. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border p-4">
      <div className="grid gap-1">
        <label htmlFor={id} className="text-base font-semibold text-foreground">
          Email me commute heads-ups
        </label>
        <p className="text-sm text-muted-foreground">
          Your week with Nalu and big traffic days, at most once a week. Sent to {user.email}, the email you signed in with.
        </p>
      </div>
      <Switch id={id} checked={on} disabled={busy} onCheckedChange={(v) => void change(v)} className="mt-0.5" />
    </div>
  );
}

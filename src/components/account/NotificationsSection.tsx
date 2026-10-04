import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BellRing } from "lucide-react";
import { toast } from "sonner";
import { LeaveAlertCard } from "@/components/LeaveAlertCard";
import { Button } from "@/components/ui/button";
import { obtainPushToken, readPushPrefs, writePushPrefs, clockToMinutes, type PushPrefs } from "@/lib/push-client";
import { savePushSubscription, sendTestPush } from "@/lib/push.functions";

const BLOCKED_COPY = {
  "not-configured": "Notifications aren't set up yet.",
  unsupported: "This browser can't show notifications. On iPhone, add Nalu to your Home Screen and open it from there.",
  "open-in-new-tab": "Open Nalu in its own tab or the installed app to turn on notifications.",
  denied: "Notifications are blocked for Nalu. Allow them in your phone's settings, then try again.",
} as const;
import type { SavedPlace } from "@/lib/places/saved-places";

/** Settings: the alerts Nalu actually sends. Off until the rider turns one on. */
export function NotificationsSection({ places }: { places: SavedPlace[] }) {
  const [prefs, setPrefs] = useState<PushPrefs | null>(null);
  const save = useServerFn(savePushSubscription);
  const test = useServerFn(sendTestPush);
  const [busy, setBusy] = useState(false);

  /** Sign this phone up and send one test, so riders can check it works. */
  async function turnOnHere() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await obtainPushToken(true);
      if (result.status !== "registered") {
        toast(BLOCKED_COPY[result.status]);
        return;
      }
      const current = readPushPrefs();
      const categories = Array.from(new Set([...current.categories, "morning_commute" as const]));
      await save({
        data: {
          token: result.token,
          ...(current.token && current.token !== result.token ? { previousToken: current.token } : {}),
          categories,
          quietStartMin: clockToMinutes(current.quietStart),
          quietEndMin: clockToMinutes(current.quietEnd),
        },
      });
      const next = { ...current, categories, token: result.token };
      writePushPrefs(next);
      setPrefs(next);
      const sent = await test({ data: { token: result.token } });
      toast(sent.status === "sent" ? "Notifications are on. A test is on its way." : "Notifications are on.");
    } catch {
      toast.error("Couldn't turn on notifications. Try again.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const current = readPushPrefs();
    setPrefs(current);
    // Token refresh: Firebase may rotate a token; swap the stored one silently.
    if (!current.token || current.categories.length === 0) return;
    void obtainPushToken(false).then(async (result) => {
      if (result.status !== "registered" || result.token === current.token) return;
      await save({
        data: {
          token: result.token,
          previousToken: current.token ?? undefined,
          categories: current.categories,
          quietStartMin: clockToMinutes(current.quietStart),
          quietEndMin: clockToMinutes(current.quietEnd),
        },
      }).catch(() => {});
      const next = { ...current, token: result.token };
      writePushPrefs(next);
      setPrefs(next);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="grid gap-4 border-t border-border pt-6" aria-labelledby="notif-title">
      <h3 id="notif-title" className="flex items-center gap-2 text-sm font-bold text-foreground">
        <BellRing className="size-4 text-primary" /> Notifications
      </h3>
      {prefs && !prefs.token && (
        <Button type="button" className="h-12 justify-self-start text-base" disabled={busy} onClick={() => void turnOnHere()}>
          Turn on notifications on this phone
        </Button>
      )}
      <LeaveAlertCard places={places} variant="settings" />
      {prefs?.token && (
        <Button
          variant="outline"
          size="sm"
          className="justify-self-start"
          onClick={() =>
            void test({ data: { token: prefs.token as string } })
              .then((r) =>
                toast(r.status === "sent" ? "Test notification sent." : "Couldn't send a test right now."),
              )
              .catch(() => toast.error("Couldn't send a test right now."))
          }
        >
          Send a test notification
        </Button>
      )}
    </section>
  );
}

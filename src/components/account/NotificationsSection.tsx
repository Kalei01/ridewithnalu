import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BellRing } from "lucide-react";
import { toast } from "sonner";
import { LeaveAlertCard } from "@/components/LeaveAlertCard";
import { Button } from "@/components/ui/button";
import { obtainPushToken, readPushPrefs, writePushPrefs, clockToMinutes, type PushPrefs } from "@/lib/push-client";
import { savePushSubscription, sendTestPush } from "@/lib/push.functions";
import type { SavedPlace } from "@/lib/places/saved-places";

/** Settings: the alerts Nalu actually sends. Off until the rider turns one on. */
export function NotificationsSection({ places }: { places: SavedPlace[] }) {
  const [prefs, setPrefs] = useState<PushPrefs | null>(null);
  const save = useServerFn(savePushSubscription);
  const test = useServerFn(sendTestPush);

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

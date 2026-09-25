import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BellRing } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  PUSH_CATEGORY_LABELS,
  clockToMinutes,
  deletePushToken,
  obtainPushToken,
  readPushPrefs,
  writePushPrefs,
  type PushCategory,
  type PushPrefs,
} from "@/lib/push-client";
import { removePushSubscription, savePushSubscription, sendTestPush } from "@/lib/push.functions";

const STATUS_COPY = {
  "not-configured": "Notifications aren't set up for this app yet.",
  unsupported:
    "This browser doesn't support notifications. On iPhone, add Nalu to your Home Screen first.",
  "open-in-new-tab": "Open Nalu in its own tab (or the installed app) to turn on notifications.",
  denied: "Notifications are blocked. Allow them for this site in your browser settings.",
} as const;

export function NotificationsSection() {
  const [prefs, setPrefs] = useState<PushPrefs>(() =>
    typeof window === "undefined"
      ? { categories: [], quietStart: "22:00", quietEnd: "06:00", token: null }
      : readPushPrefs(),
  );
  const [busy, setBusy] = useState(false);
  const save = useServerFn(savePushSubscription);
  const remove = useServerFn(removePushSubscription);
  const test = useServerFn(sendTestPush);

  // Token refresh: Firebase may rotate a token; swap the stored one silently.
  useEffect(() => {
    if (!prefs.token || prefs.categories.length === 0) return;
    void obtainPushToken(false).then(async (result) => {
      if (result.status !== "registered" || result.token === prefs.token) return;
      const next = { ...prefs, token: result.token };
      await sync(next, prefs.token).catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sync(next: PushPrefs, previousToken?: string | null) {
    if (!next.token) return;
    await save({
      data: {
        token: next.token,
        ...(previousToken && previousToken !== next.token ? { previousToken } : {}),
        categories: next.categories,
        quietStartMin: clockToMinutes(next.quietStart),
        quietEndMin: clockToMinutes(next.quietEnd),
      },
    });
    setPrefs(next);
    writePushPrefs(next);
  }

  async function toggle(category: PushCategory, on: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      const categories = on
        ? Array.from(new Set([...prefs.categories, category]))
        : prefs.categories.filter((c) => c !== category);
      let token = prefs.token;
      if (on && !token) {
        const result = await obtainPushToken(true);
        if (result.status !== "registered") {
          toast(STATUS_COPY[result.status]);
          return;
        }
        token = result.token;
      }
      if (!token) return;
      if (categories.length === 0) {
        await remove({ data: { token } });
        await deletePushToken();
        const next = { ...prefs, categories, token: null };
        setPrefs(next);
        writePushPrefs(next);
        return;
      }
      await sync({ ...prefs, categories, token });
    } catch {
      toast.error("Couldn't update notifications. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function updateQuiet(field: "quietStart" | "quietEnd", value: string) {
    const next = { ...prefs, [field]: value };
    setPrefs(next);
    writePushPrefs(next);
    if (next.token && next.categories.length) await sync(next).catch(() => {});
  }

  return (
    <section className="grid gap-3 border-t border-border pt-6" aria-labelledby="notif-title">
      <div>
        <h3 id="notif-title" className="flex items-center gap-2 text-sm font-bold text-foreground">
          <BellRing className="size-4 text-primary" /> Notifications
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Off until you pick a category. Nalu never signs you up for alerts on its own.
        </p>
      </div>
      {(Object.keys(PUSH_CATEGORY_LABELS) as PushCategory[]).map((category) => (
        <div key={category} className="flex items-center justify-between gap-3">
          <Label htmlFor={`push-${category}`} className="grid gap-0.5">
            <span className="text-sm font-semibold">{PUSH_CATEGORY_LABELS[category].label}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {PUSH_CATEGORY_LABELS[category].hint}
            </span>
          </Label>
          <Switch
            id={`push-${category}`}
            checked={prefs.categories.includes(category)}
            disabled={busy}
            onCheckedChange={(on) => void toggle(category, on)}
          />
        </div>
      ))}
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1">
          <Label htmlFor="quiet-start" className="text-xs">
            Quiet from
          </Label>
          <Input
            id="quiet-start"
            type="time"
            value={prefs.quietStart}
            onChange={(e) => void updateQuiet("quietStart", e.target.value)}
            className="bg-surface-raised"
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="quiet-end" className="text-xs">
            Until
          </Label>
          <Input
            id="quiet-end"
            type="time"
            value={prefs.quietEnd}
            onChange={(e) => void updateQuiet("quietEnd", e.target.value)}
            className="bg-surface-raised"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        During quiet hours only stop and transfer alerts you asked for on an active trip come
        through.
      </p>
      {prefs.token && prefs.categories.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            void test({ data: { token: prefs.token as string } })
              .then((r) =>
                toast(
                  r.status === "sent"
                    ? "Test notification sent."
                    : "Couldn't send a test right now.",
                ),
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

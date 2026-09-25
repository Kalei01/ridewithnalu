export const PUSH_CATEGORIES = [
  "morning_commute",
  "major_traffic",
  "transit_disruption",
  "stop_transfer",
] as const;
export type PushCategory = (typeof PUSH_CATEGORIES)[number];

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";

function honoluluMinutes(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Pacific/Honolulu",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return read("hour") * 60 + read("minute");
}

export function inQuietHours(start: number | null, end: number | null, now = new Date()) {
  if (start === null || end === null || start === end) return false;
  const minute = honoluluMinutes(now);
  return start < end ? minute >= start && minute < end : minute >= start || minute < end;
}

type Subscription = {
  token: string;
  categories: string[];
  quiet_start_min: number | null;
  quiet_end_min: number | null;
};

export type PushMessage = {
  category: PushCategory;
  title: string;
  body: string;
  dedupeKey: string;
  path?: string;
};

/** Send to one subscription, honouring opt-in, quiet hours, and dedupe. */
export async function sendToSubscription(
  sub: Subscription,
  message: PushMessage,
): Promise<"sent" | "skipped" | "removed" | "failed"> {
  if (!sub.categories.includes(message.category)) return "skipped";
  // Stop/transfer alerts are time-critical and the rider asked for them mid-trip.
  if (message.category !== "stop_transfer" && inQuietHours(sub.quiet_start_min, sub.quiet_end_min))
    return "skipped";

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error: dedupeError } = await supabaseAdmin
    .from("push_deliveries")
    .insert({ token: sub.token, dedupe_key: message.dedupeKey.slice(0, 200) });
  if (dedupeError) return "skipped"; // unique violation: already delivered

  const lovableKey = process.env.LOVABLE_API_KEY;
  const connectionKey = process.env.FIREBASE_MESSAGING_API_KEY;
  if (!lovableKey || !connectionKey) throw new Error("Push notifications are not configured.");

  const response = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connectionKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        token: sub.token,
        notification: { title: message.title, body: message.body },
        data: { category: message.category, path: message.path ?? "/" },
        webpush: { fcm_options: { link: message.path ?? "/" } },
      },
    }),
  });
  if (response.ok) return "sent";
  const body = await response.text();
  console.error(`FCM send failed [${response.status}]: ${body}`);
  if (response.status === 404 || (response.status === 400 && /INVALID_ARGUMENT|UNREGISTERED/.test(body))) {
    await supabaseAdmin.from("push_subscriptions").delete().eq("token", sub.token);
    return "removed";
  }
  // Let a later retry through the dedupe gate.
  await supabaseAdmin
    .from("push_deliveries")
    .delete()
    .eq("token", sub.token)
    .eq("dedupe_key", message.dedupeKey.slice(0, 200));
  return "failed";
}

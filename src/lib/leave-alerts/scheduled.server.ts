/** Sends one-time reminders (like the last-bus alert) whose time has come. */
export async function sendDueReminders(now = new Date()) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendToSubscription } = await import("@/lib/push.server");
  const counts = { sent: 0, failed: 0 };
  const { data: due } = await supabaseAdmin
    .from("scheduled_pushes")
    .select("token, kind, send_at, title, body")
    .lte("send_at", now.toISOString())
    .limit(100);
  for (const reminder of due ?? []) {
    const { data: sub } = await supabaseAdmin
      .from("push_subscriptions")
      .select("token, categories, quiet_start_min, quiet_end_min")
      .eq("token", reminder.token)
      .maybeSingle();
    // A reminder more than 20 minutes late would only mislead; drop it.
    const stale = now.getTime() - new Date(reminder.send_at).getTime() > 20 * 60_000;
    if (sub && !stale) {
      const status = await sendToSubscription(
        { ...sub, categories: Array.from(new Set([...sub.categories, "stop_transfer"])) },
        {
          category: "stop_transfer",
          title: reminder.title,
          body: reminder.body,
          dedupeKey: `${reminder.kind}-${reminder.send_at}`,
          path: "/",
        },
      );
      counts[status === "sent" ? "sent" : "failed"] += 1;
    }
    await supabaseAdmin
      .from("scheduled_pushes")
      .delete()
      .eq("token", reminder.token)
      .eq("kind", reminder.kind)
      .eq("send_at", reminder.send_at);
  }
  return counts;
}

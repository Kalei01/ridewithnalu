/**
 * The scheduled "Time to leave" job: every few minutes, look at alerts whose
 * leave time is getting close, re-plan them with live traffic and the current
 * timetable, and send one notification per alert per day.
 */

import { destinationAccess } from "@/lib/destination-access";
import { lookupDriveTime } from "@/lib/drive.functions";
import { MAX_STOP_WALK_M } from "@/lib/rail/walk-preference";
import {
  WINDOW_BEFORE_ARRIVAL_SECONDS,
  chooseLeave,
  leaveMessage,
  nextCheckDelaySeconds,
  shouldSend,
  type TransitCandidate,
} from "./plan";

const MAX_ALERTS_PER_RUN = 40;

function honoluluNow(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Pacific/Honolulu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const isoDow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday")) + 1;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    isoDow,
    seconds: Number(get("hour")) * 3600 + Number(get("minute")) * 60 + Number(get("second")),
  };
}

export async function runLeaveAlerts(now = new Date()) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendToSubscription } = await import("@/lib/push.server");
  const hst = honoluluNow(now);
  const counts = { checked: 0, sent: 0, waiting: 0, skipped: 0, failed: 0 };

  const { data: alerts, error } = await supabaseAdmin
    .from("leave_alerts")
    .select("*")
    .contains("days", [hst.isoDow])
    .or(`last_sent_on.is.null,last_sent_on.lt.${hst.date}`)
    .limit(500);
  if (error) throw new Error("Leave alert lookup failed");
  const due = (alerts ?? []).filter(
    (alert) => !alert.next_check_at || new Date(alert.next_check_at).getTime() <= now.getTime(),
  );

  const later = (seconds: number) => new Date(now.getTime() + seconds * 1000).toISOString();

  for (const alert of due.slice(0, MAX_ALERTS_PER_RUN)) {
    const target = alert.arrive_min * 60;
    const opensAt = target - WINDOW_BEFORE_ARRIVAL_SECONDS;
    if (hst.seconds < opensAt) {
      await supabaseAdmin
        .from("leave_alerts")
        .update({ next_check_at: later(opensAt - hst.seconds) })
        .eq("token", alert.token)
        .eq("place_key", alert.place_key);
      counts.waiting += 1;
      continue;
    }
    if (hst.seconds > target - 120) {
      // Too late to help today; try again on the next matching day.
      await supabaseAdmin
        .from("leave_alerts")
        .update({ last_sent_on: hst.date, next_check_at: null })
        .eq("token", alert.token)
        .eq("place_key", alert.place_key);
      counts.skipped += 1;
      continue;
    }

    counts.checked += 1;
    try {
      const from = { lat: Number(alert.origin_lat), lon: Number(alert.origin_lon) };
      const to = { lat: Number(alert.dest_lat), lon: Number(alert.dest_lon) };
      const arrivalDate = new Date(now.getTime() + (target - hst.seconds) * 1000);
      const access = destinationAccess(to, alert.to_home ? "home" : null, arrivalDate);
      const transitArgs = {
        p_origin_lat: from.lat,
        p_origin_lon: from.lon,
        p_dest_lat: to.lat,
        p_dest_lon: to.lon,
        p_after_seconds: hst.seconds,
        p_limit: 8,
        p_origin_radius_m: MAX_STOP_WALK_M,
        p_dest_radius_m: MAX_STOP_WALK_M,
      };
      const [drive, general, direct] = await Promise.all([
        lookupDriveTime({ fromLat: from.lat, fromLon: from.lon, toLat: to.lat, toLon: to.lon }),
        supabaseAdmin.rpc("plan_transit_general", transitArgs),
        supabaseAdmin.rpc("plan_bus_direct", transitArgs),
      ]);
      const transit = [...(general.data ?? []), ...(direct.data ?? [])] as unknown as TransitCandidate[];
      const plan = chooseLeave({
        nowSeconds: hst.seconds,
        targetArriveSeconds: target,
        drive: drive ? { trafficMinutes: drive.trafficMinutes, delayMinutes: drive.delayMinutes } : null,
        parkingMinutes: access.typicalMin,
        transit,
      });
      if (!plan) {
        await supabaseAdmin
          .from("leave_alerts")
          .update({ next_check_at: later(5 * 60) })
          .eq("token", alert.token)
          .eq("place_key", alert.place_key);
        counts.failed += 1;
        continue;
      }
      if (!shouldSend(plan, hst.seconds)) {
        await supabaseAdmin
          .from("leave_alerts")
          .update({ next_check_at: later(nextCheckDelaySeconds(plan, hst.seconds)) })
          .eq("token", alert.token)
          .eq("place_key", alert.place_key);
        counts.waiting += 1;
        continue;
      }

      const { data: sub } = await supabaseAdmin
        .from("push_subscriptions")
        .select("token, categories, quiet_start_min, quiet_end_min")
        .eq("token", alert.token)
        .maybeSingle();
      const message = leaveMessage(plan, alert.place_label, alert.to_home);
      const status = sub
        ? await sendToSubscription(
            { ...sub, categories: Array.from(new Set([...sub.categories, "morning_commute"])) },
            {
              category: "morning_commute",
              ...message,
              dedupeKey: `leave-${alert.place_key}-${hst.date}`,
              path: "/",
            },
            { ignoreQuietHours: true },
          )
        : "skipped";
      if (status === "sent" || status === "skipped") {
        await supabaseAdmin
          .from("leave_alerts")
          .update({ last_sent_on: hst.date, next_check_at: null })
          .eq("token", alert.token)
          .eq("place_key", alert.place_key);
      }
      counts[status === "sent" ? "sent" : status === "skipped" ? "skipped" : "failed"] += 1;
    } catch (cause) {
      console.error("[leave-alerts] plan failed", cause instanceof Error ? cause.message : cause);
      counts.failed += 1;
    }
  }
  return counts;
}

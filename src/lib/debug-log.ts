/**
 * Temporary navigation diagnostics. Events buffer in memory and ship in
 * small batches (every ~3.5 min, on trip end, or on failure). No addresses
 * or coordinates ever leave the device: location-like keys are dropped.
 */
import { purgeDebugLogs, submitDebugLogs } from "./debug-logs.functions";

type Value = number | boolean | string | null;
type Event = { t: number; type: string; data?: Record<string, Value> };
type Reason = "interval" | "trip_end" | "failure" | "pagehide";

const DEVICE_KEY = "nalu.debug-device";
const FLUSH_MS = 210_000;
const MAX_BYTES = 48_000;
const BLOCKED = /lat|lon|lng|coord|address|street|place|name|query|point|gps/i;

let buffer: Event[] = [];
let sessionId: string | null = null;
let timer: number | null = null;

function uuid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function debugDeviceId() {
  try {
    let v = localStorage.getItem(DEVICE_KEY);
    if (!v) {
      v = uuid();
      localStorage.setItem(DEVICE_KEY, v);
    }
    return v;
  } catch {
    return "unknown-device";
  }
}

export function sanitize(data?: Record<string, unknown>): Record<string, Value> | undefined {
  if (!data) return undefined;
  const out: Record<string, Value> = {};
  for (const [k, v] of Object.entries(data)) {
    if (BLOCKED.test(k)) continue;
    if (typeof v === "number") out[k] = Number.isFinite(v) ? Math.round(v * 10) / 10 : null;
    else if (typeof v === "boolean" || v === null) out[k] = v;
    else if (typeof v === "string") out[k] = v.slice(0, 120);
  }
  return out;
}

export function debugLog(type: string, data?: Record<string, unknown>) {
  if (!sessionId) return;
  buffer.push({ t: Date.now(), type: type.slice(0, 40), data: sanitize(data) });
  if (buffer.length > 400) buffer = buffer.slice(-400);
}

export async function flushDebugLogs(reason: Reason) {
  if (!sessionId || buffer.length === 0) return;
  let events = buffer;
  buffer = [];
  while (JSON.stringify(events).length > MAX_BYTES && events.length > 1)
    events = events.slice(Math.ceil(events.length / 4));
  try {
    await submitDebugLogs({ data: { deviceId: debugDeviceId(), sessionId, reason, events } });
  } catch {
    // Diagnostics are best-effort and must never disturb navigation.
  }
}

const onHide = () => {
  if (document.visibilityState === "hidden") void flushDebugLogs("pagehide");
};

export function startDebugSession() {
  if (typeof window === "undefined" || sessionId) return;
  sessionId = uuid();
  buffer = [];
  timer = window.setInterval(() => void flushDebugLogs("interval"), FLUSH_MS);
  document.addEventListener("visibilitychange", onHide);
  debugLog("session_start");
}

export async function endDebugSession(reason: Reason = "trip_end") {
  if (!sessionId) return;
  debugLog("session_end", { reason });
  if (timer !== null) window.clearInterval(timer);
  timer = null;
  document.removeEventListener("visibilitychange", onHide);
  await flushDebugLogs(reason);
  sessionId = null;
}

export async function purgeMyDebugLogs() {
  buffer = [];
  const res = await purgeDebugLogs({ data: { deviceId: debugDeviceId() } });
  return res.ok;
}

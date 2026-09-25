/** Browser side of opt-in push: permission, token, refresh and removal. */
export type PushCategory =
  | "morning_commute"
  | "major_traffic"
  | "transit_disruption"
  | "stop_transfer";

export const PUSH_CATEGORY_LABELS: Record<PushCategory, { label: string; hint: string }> = {
  morning_commute: { label: "Morning commute", hint: "A heads-up before your usual departure" },
  major_traffic: { label: "Major traffic", hint: "Big delays or crashes on your route" },
  transit_disruption: { label: "Rail & transit disruptions", hint: "Service changes on Skyline and TheBus" },
  stop_transfer: { label: "Stop & transfer alerts", hint: "When your stop or transfer is coming up" },
};

export type PushPrefs = {
  categories: PushCategory[];
  quietStart: string; // "22:00" or ""
  quietEnd: string;
  token: string | null;
};

export const PUSH_PREFS_KEY = "nalu-push-prefs-v1";
export const defaultPushPrefs: PushPrefs = {
  categories: [],
  quietStart: "22:00",
  quietEnd: "06:00",
  token: null,
};

export function readPushPrefs(): PushPrefs {
  try {
    const raw = window.localStorage.getItem(PUSH_PREFS_KEY);
    return raw ? { ...defaultPushPrefs, ...(JSON.parse(raw) as Partial<PushPrefs>) } : defaultPushPrefs;
  } catch {
    return defaultPushPrefs;
  }
}
export function writePushPrefs(prefs: PushPrefs) {
  window.localStorage.setItem(PUSH_PREFS_KEY, JSON.stringify(prefs));
}

const appId = import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_APP_ID as string | undefined;
const vapidKey = import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY as string | undefined;
const firebaseConfig = {
  apiKey: (import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY as string) ?? "",
  projectId: (import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_PROJECT_ID as string) ?? "",
  appId: appId ?? "",
  messagingSenderId: appId?.split(":")[1] ?? "",
};

export type PushResult =
  | { status: "registered"; token: string }
  | { status: "not-configured" | "unsupported" | "open-in-new-tab" | "denied" };

async function messagingInstance() {
  const [{ initializeApp, getApps }, messaging] = await Promise.all([
    import("firebase/app"),
    import("firebase/messaging"),
  ]);
  const app = getApps()[0] ?? initializeApp(firebaseConfig);
  return { messaging, instance: messaging.getMessaging(app) };
}

/** Must run from a tap. `prompt: false` only refreshes an already-granted token. */
export async function obtainPushToken(prompt = true): Promise<PushResult> {
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !appId || !vapidKey || !firebaseConfig.messagingSenderId)
    return { status: "not-configured" };
  const { isSupported } = await import("firebase/messaging");
  if (!("Notification" in window) || !(await isSupported())) return { status: "unsupported" };
  if (window.top !== window.self) return { status: "open-in-new-tab" };
  let permission = Notification.permission;
  if (permission !== "granted") {
    if (!prompt) return { status: "denied" };
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") return { status: "denied" };
  const query = new URLSearchParams(firebaseConfig).toString();
  const serviceWorkerRegistration = await navigator.serviceWorker.register(
    `/firebase-messaging-sw.js?${query}`,
  );
  const { messaging, instance } = await messagingInstance();
  const token = await messaging.getToken(instance, { vapidKey, serviceWorkerRegistration });
  return token ? { status: "registered", token } : { status: "denied" };
}

export async function deletePushToken() {
  try {
    const { messaging, instance } = await messagingInstance();
    await messaging.deleteToken(instance);
  } catch {
    // Already gone.
  }
}

export function clockToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

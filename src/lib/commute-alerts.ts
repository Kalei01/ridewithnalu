export type TrafficAlertSnapshot = {
  delayMinutes: number;
  incidentKeys: string[];
};

export type TrafficAlertChange =
  | { kind: "delay"; increaseMinutes: number }
  | { kind: "incident" }
  | null;

/** Compare successive live refreshes without announcing the initial snapshot. */
export function detectTrafficAlert(
  previous: TrafficAlertSnapshot | null,
  current: TrafficAlertSnapshot,
): TrafficAlertChange {
  if (!previous) return null;
  const increaseMinutes = current.delayMinutes - previous.delayMinutes;
  if (increaseMinutes >= 5) return { kind: "delay", increaseMinutes };
  const oldIncidents = new Set(previous.incidentKeys);
  return current.incidentKeys.some((key) => !oldIncidents.has(key)) ? { kind: "incident" } : null;
}

export function requestCommuteNotificationPermission() {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (window.Notification.permission === "default") void window.Notification.requestPermission().catch(() => {});
  } catch {
    // Notification access is optional and must never interrupt starting a trip.
  }
}

export function postCommuteNotification(title: string, body: string, tag: string) {
  try {
    if (typeof window === "undefined" || !("Notification" in window) || window.Notification.permission !== "granted") return;
    new window.Notification(title, { body, tag });
  } catch {
    // Some browsers expose Notification but still block construction.
  }
}

export function speakCommuteAlert(message: string) {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || typeof window.SpeechSynthesisUtterance !== "function") return;
    const utterance = new window.SpeechSynthesisUtterance(message);
    utterance.lang = "en-US";
    utterance.rate = 0.94;
    utterance.volume = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  } catch {
    // Speech is best-effort on browsers that suspend audio in the background.
  }
}
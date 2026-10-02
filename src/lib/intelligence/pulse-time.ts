export type PulseClock = {
  timezone: string;
  weekday: string;
  hour: number;
  minute: number;
};

const WEEKDAYS = new Set(["Mon", "Tue", "Wed", "Thu", "Fri"]);

export function localPulseClock(date: Date, timezone: string): PulseClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);

  return {
    timezone,
    weekday: parts.find((part) => part.type === "weekday")?.value ?? "",
    hour,
    minute,
  };
}

export function isWeekday(clock: PulseClock) {
  return WEEKDAYS.has(clock.weekday);
}

export function minutesSinceMidnight(clock: PulseClock) {
  return clock.hour * 60 + clock.minute;
}

export function isWithinLocalWindow(clock: PulseClock, startMinute: number, endMinute: number) {
  const minute = minutesSinceMidnight(clock);
  return isWeekday(clock) && minute >= startMinute && minute < endMinute;
}

export function formatLocalTime(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

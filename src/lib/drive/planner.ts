/** Pure, portable helpers for interpreting TomTom drive estimates. */
export const DRIVE_DESTINATION_BUFFER_MIN = 5;

export type DrivePlan = {
  leaveBySeconds: number;
  arriveSeconds: number;
  feasible: boolean;
  earliestArriveSeconds: number;
  bufferMinutes: number;
  estimated: boolean;
};

export function planDriveArrival(arriveBySeconds: number, driveMinutes: number, nowSeconds: number, bufferMinutes = DRIVE_DESTINATION_BUFFER_MIN, estimated = false): DrivePlan {
  const doorToDoorSeconds = (driveMinutes + bufferMinutes) * 60;
  const requestedLeave = arriveBySeconds - doorToDoorSeconds;
  const earliestArriveSeconds = nowSeconds + doorToDoorSeconds;
  const feasible = requestedLeave >= nowSeconds;
  return {
    leaveBySeconds: feasible ? requestedLeave : nowSeconds,
    arriveSeconds: feasible ? arriveBySeconds : earliestArriveSeconds,
    feasible,
    earliestArriveSeconds,
    bufferMinutes,
    estimated,
  };
}

/** Convert a Honolulu seconds-since-midnight target into an ISO instant. */
export function honoluluSecondsToIso(seconds: number, reference = new Date()): string {
  const dateParts = new Intl.DateTimeFormat("en-CA", { timeZone: "Pacific/Honolulu", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(reference);
  const read = (type: Intl.DateTimeFormatPartTypes) => dateParts.find((part) => part.type === type)?.value ?? "";
  const normalized = ((Math.round(seconds) % 86400) + 86400) % 86400;
  const hh = String(Math.floor(normalized / 3600)).padStart(2, "0");
  const mm = String(Math.floor((normalized % 3600) / 60)).padStart(2, "0");
  const ss = String(normalized % 60).padStart(2, "0");
  return `${read("year")}-${read("month")}-${read("day")}T${hh}:${mm}:${ss}-10:00`;
}

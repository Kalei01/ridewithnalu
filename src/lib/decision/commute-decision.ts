export type Recommendation = "rail" | "drive" | "same" | "none";
export type DecisionInput = {
  railMinutes: number | null;
  driveMinutes: number | null;
  driveAvailable: boolean;
  railLeaveBySeconds?: number | null;
  driveLeaveBySeconds?: number | null;
  driveDelayMinutes?: number | null;
  hasMajorIncident?: boolean;
  railWaitMinutes?: number | null;
  thresholdMinutes?: number;
};
export type CommuteDecision = { recommendation: Recommendation; differenceMinutes: number | null; explanation: string | null };

export function compareCommute(input: DecisionInput): CommuteDecision {
  const threshold = input.thresholdMinutes ?? 5;
  const drive = input.driveAvailable ? input.driveMinutes : null;
  if (input.railMinutes === null && drive === null) return { recommendation: "none", differenceMinutes: null, explanation: null };
  if (input.railMinutes === null) return { recommendation: "drive", differenceMinutes: null, explanation: "Driving is the available option right now" };
  if (drive === null) return { recommendation: "rail", differenceMinutes: null, explanation: "Driving is not available from your starting point" };
  const difference = drive - input.railMinutes;
  const recommendation: Recommendation = Math.abs(difference) < threshold ? "same" : difference > 0 ? "rail" : "drive";
  if (recommendation === "rail" && input.hasMajorIncident) return { recommendation, differenceMinutes: Math.abs(difference), explanation: "Rail avoids a reported traffic incident" };
  if (recommendation === "rail" && (input.driveDelayMinutes ?? 0) >= 5) return { recommendation, differenceMinutes: Math.abs(difference), explanation: `Rail avoids about ${input.driveDelayMinutes} min of traffic delay` };
  if (recommendation === "drive" && input.railWaitMinutes !== null && input.railWaitMinutes !== undefined && input.railWaitMinutes >= 10) return { recommendation, differenceMinutes: Math.abs(difference), explanation: `Driving avoids a ${input.railWaitMinutes} min wait for rail` };
  if (recommendation === "same") return { recommendation, differenceMinutes: 0, explanation: "Both options should arrive at about the same time" };
  return { recommendation, differenceMinutes: Math.abs(difference), explanation: recommendation === "drive" ? `Driving is about ${Math.abs(difference)} min faster` : `Rail is about ${Math.abs(difference)} min faster` };
}

export function compareArriveBy(input: { railLeaveBySeconds: number | null; railArriveSeconds: number | null; driveLeaveBySeconds: number | null; driveArriveSeconds: number | null }, thresholdMinutes = 5) {
  const haveRail = input.railLeaveBySeconds !== null && input.railArriveSeconds !== null;
  const haveDrive = input.driveLeaveBySeconds !== null && input.driveArriveSeconds !== null;
  if (!haveRail && !haveDrive) return { winner: "none" as const, laterMinutes: 0, earlierMinutes: 0 };
  if (!haveRail) return { winner: "drive" as const, laterMinutes: 0, earlierMinutes: 0 };
  if (!haveDrive) return { winner: "rail" as const, laterMinutes: 0, earlierMinutes: 0 };
  const later = Math.round(((input.driveLeaveBySeconds ?? 0) - (input.railLeaveBySeconds ?? 0)) / 60);
  const earlier = Math.round(((input.railArriveSeconds ?? 0) - (input.driveArriveSeconds ?? 0)) / 60);
  if (Math.abs(later) < thresholdMinutes) return { winner: "same" as const, laterMinutes: 0, earlierMinutes: 0 };
  return later > 0
    ? { winner: "drive" as const, laterMinutes: later, earlierMinutes: Math.max(0, earlier) }
    : { winner: "rail" as const, laterMinutes: Math.abs(later), earlierMinutes: Math.max(0, -earlier) };
}

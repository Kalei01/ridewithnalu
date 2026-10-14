import {
  planTransitTripDetailed,
  type TransitPlanContext,
  type TransitPlanResult,
} from "@/lib/transit-plan";
import { planTripServer, toTripPlanInput } from "@/lib/transit-plan.functions";
import { debugLog } from "@/lib/debug-log";

/**
 * The on/off switch for Phase 2 (docs/architecture/fix-plan.md).
 * On: the phone asks the server for the whole trip search in one request.
 * Off: the phone runs every search itself, as before. Rollback = set false.
 * On since Oct 13, 2026 after the side-by-side proof (scripts/phase2/).
 */
export const SERVER_TRIP_PLAN = true;

const OVERRIDE_KEY = "nalu-plan-path";

/**
 * Which path this tab uses. `?plan=server` or `?plan=phone` overrides the
 * switch for this tab only (side-by-side checks); nothing else is stored.
 */
export function serverTripPlanOn(): boolean {
  if (typeof window === "undefined") return SERVER_TRIP_PLAN;
  try {
    const asked = new URLSearchParams(window.location.search).get("plan");
    if (asked === "server" || asked === "phone") sessionStorage.setItem(OVERRIDE_KEY, asked);
    const chosen = sessionStorage.getItem(OVERRIDE_KEY);
    if (chosen === "server") return true;
    if (chosen === "phone") return false;
  } catch {
    /* storage blocked: use the switch */
  }
  return SERVER_TRIP_PLAN;
}

/**
 * Arrive By with a car times every station for every departure (up to ~40
 * outgoing calls and the most server work per trip; Workers' free plan allows
 * 50 calls and 10 ms of CPU). Until its real CPU time on Cloudflare has been
 * read, it stays on the phone path rather than risk being run twice.
 */
export function fitsOneServerRequest(ctx: TransitPlanContext): boolean {
  return !(ctx.planMode === "arrive-by" && ctx.vehicleToStation === "vehicle");
}

/**
 * The trip search the trip screen runs. With the switch on it is one server
 * request; if that request itself can't be made (offline, server error, too
 * many requests), the phone runs the same search itself so the rider still
 * gets an answer. A search that ran and failed is not repeated: it shows as
 * "Can't check", exactly as on the phone path.
 */
export async function planTrip(ctx: TransitPlanContext): Promise<TransitPlanResult> {
  if (!serverTripPlanOn() || !fitsOneServerRequest(ctx)) return planTransitTripDetailed(ctx);
  let answer: Awaited<ReturnType<typeof planTripServer>>;
  try {
    answer = await planTripServer({ data: toTripPlanInput(ctx) });
  } catch (error) {
    debugLog("trip_plan_fallback", {
      message: error instanceof Error ? error.message.slice(0, 80) : "request failed",
    });
    return planTransitTripDetailed(ctx);
  }
  debugLog("trip_plan_server", {
    ms: answer.timing.ms,
    searches: answer.timing.searchesSent,
    drives: answer.timing.driveLookups,
    late: answer.timing.late,
    failed: answer.failed,
    over_budget: answer.overBudget,
  });
  // Too big for one server request: the phone runs it, so the answer is never cut short.
  if (answer.overBudget) return planTransitTripDetailed(ctx);
  // Same as a planner failure on the phone: both rows say "Can't check".
  if (answer.failed) throw new Error("Trip search failed on the server");
  return { options: answer.options, unchecked: answer.unchecked };
}

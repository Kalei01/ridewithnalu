export type VoicePriority = "safety" | "reroute" | "maneuver" | "traffic" | "transit" | "info";

export type VoicePriorityRequest = {
  message: string;
  priority: VoicePriority;
  enqueuedAt?: number;
};

const PRIORITY_RANK: Record<VoicePriority, number> = {
  safety: 100,
  reroute: 90,
  maneuver: 80,
  traffic: 60,
  transit: 40,
  info: 20,
};

export function voicePriorityRank(priority: VoicePriority) {
  return PRIORITY_RANK[priority];
}

/**
 * Small, deterministic arbitration layer for spoken navigation.
 * It never stores an unbounded queue: at most one pending message survives
 * while another message is speaking. This prevents stale traffic/information
 * from being spoken after the driver has moved on.
 */
export class VoicePriorityQueue {
  private active: VoicePriorityRequest | null = null;
  private pending: VoicePriorityRequest | null = null;

  enqueue(request: VoicePriorityRequest) {
    const normalized = { ...request, enqueuedAt: request.enqueuedAt ?? Date.now() };

    if (!this.active) {
      this.active = normalized;
      return { action: "start" as const, request: normalized };
    }

    if (voicePriorityRank(normalized.priority) > voicePriorityRank(this.active.priority)) {
      const interrupted = this.active;
      this.active = normalized;
      this.pending = null;
      return { action: "interrupt" as const, request: normalized, interrupted };
    }

    if (
      !this.pending ||
      voicePriorityRank(normalized.priority) >= voicePriorityRank(this.pending.priority)
    ) {
      this.pending = normalized;
    }

    return { action: "queued" as const, request: normalized };
  }

  finish(request: VoicePriorityRequest) {
    if (this.active !== request) return null;
    this.active = null;
    const next = this.pending;
    this.pending = null;
    if (!next) return null;
    this.active = next;
    return next;
  }

  clear() {
    this.active = null;
    this.pending = null;
  }

  getActive() {
    return this.active;
  }

  getPending() {
    return this.pending;
  }
}

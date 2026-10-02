import { describe, expect, it } from "vitest";
import { VoicePriorityQueue } from "./voice-priority-queue";

describe("VoicePriorityQueue", () => {
  it("starts the first message immediately", () => {
    const queue = new VoicePriorityQueue();
    const request = { message: "Turn left", priority: "maneuver" as const, enqueuedAt: 1 };
    expect(queue.enqueue(request)).toMatchObject({ action: "start", request });
    expect(queue.getActive()).toEqual(request);
  });

  it("lets an urgent maneuver interrupt a lower-priority traffic alert", () => {
    const queue = new VoicePriorityQueue();
    const traffic = { message: "Traffic is building", priority: "traffic" as const, enqueuedAt: 1 };
    const maneuver = { message: "Turn right", priority: "maneuver" as const, enqueuedAt: 2 };

    queue.enqueue(traffic);
    expect(queue.enqueue(maneuver)).toMatchObject({
      action: "interrupt",
      request: maneuver,
      interrupted: traffic,
    });
    expect(queue.getActive()).toEqual(maneuver);
  });

  it("keeps only the most relevant pending message", () => {
    const queue = new VoicePriorityQueue();
    const maneuver = { message: "Turn right", priority: "maneuver" as const, enqueuedAt: 1 };
    const traffic = { message: "Traffic ahead", priority: "traffic" as const, enqueuedAt: 2 };
    const info = { message: "Your ETA is 20 minutes", priority: "info" as const, enqueuedAt: 3 };

    queue.enqueue(maneuver);
    queue.enqueue(traffic);
    queue.enqueue(info);

    expect(queue.getPending()).toEqual(traffic);
  });

  it("replaces an older pending message with an equally important newer one", () => {
    const queue = new VoicePriorityQueue();
    const active = { message: "Traffic ahead", priority: "traffic" as const, enqueuedAt: 1 };
    const first = { message: "Traffic +5 minutes", priority: "traffic" as const, enqueuedAt: 2 };
    const newer = { message: "Incident ahead", priority: "traffic" as const, enqueuedAt: 3 };

    queue.enqueue(active);
    queue.enqueue(first);
    queue.enqueue(newer);

    expect(queue.getPending()).toEqual(newer);
  });

  it("promotes the pending message when speech finishes", () => {
    const queue = new VoicePriorityQueue();
    const active = { message: "Traffic ahead", priority: "traffic" as const, enqueuedAt: 1 };
    const pending = { message: "Train approaching", priority: "transit" as const, enqueuedAt: 2 };

    const activeRequest = queue.enqueue(active);
    queue.enqueue(pending);

    expect(activeRequest.action).toBe("start");
    expect(queue.finish(activeRequest.request)).toEqual(pending);
    expect(queue.getActive()).toEqual(pending);
    expect(queue.getPending()).toBeNull();
  });

  it("clears stale speech state", () => {
    const queue = new VoicePriorityQueue();
    const active = { message: "Turn left", priority: "maneuver" as const };
    queue.enqueue(active);
    queue.clear();

    expect(queue.getActive()).toBeNull();
    expect(queue.getPending()).toBeNull();
  });
});

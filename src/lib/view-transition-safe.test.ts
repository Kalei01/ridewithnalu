import { describe, expect, it, vi } from "vitest";
import { installSafeViewTransitions, isBenignViewTransitionAbort } from "./view-transition-safe";

function fakeDoc(visibility: "visible" | "hidden", transition?: unknown) {
  return {
    visibilityState: visibility,
    startViewTransition: vi.fn(() => transition),
  } as unknown as Document & { startViewTransition: ReturnType<typeof vi.fn> };
}

describe("installSafeViewTransitions", () => {
  it("runs the update directly when the tab is hidden", async () => {
    const doc = fakeDoc("hidden");
    const original = doc.startViewTransition;
    installSafeViewTransitions(doc);
    const update = vi.fn();
    const t = (
      doc as never as {
        startViewTransition: (f: () => void) => { updateCallbackDone: Promise<void> };
      }
    ).startViewTransition(update);
    await t.updateCallbackDone;
    expect(update).toHaveBeenCalledTimes(1);
    expect(original).not.toHaveBeenCalled();
  });

  it("swallows rejected ready/finished promises of a real transition", async () => {
    const reject = () =>
      Promise.reject(new DOMException("Transition was aborted", "InvalidStateError"));
    const doc = fakeDoc("visible", {
      updateCallbackDone: Promise.resolve(),
      ready: reject(),
      finished: reject(),
    });
    installSafeViewTransitions(doc);
    (doc as never as { startViewTransition: (f: () => void) => unknown }).startViewTransition(
      () => undefined,
    );
    await new Promise((r) => setTimeout(r, 0));
  });
});

describe("isBenignViewTransitionAbort", () => {
  it("matches only the exact aborted-transition error", () => {
    expect(
      isBenignViewTransitionAbort(
        "InvalidStateError",
        "Transition was aborted because of invalid state",
      ),
    ).toBe(true);
    expect(isBenignViewTransitionAbort("TypeError", "Transition was aborted")).toBe(false);
    expect(isBenignViewTransitionAbort("InvalidStateError", "Something else")).toBe(false);
  });
});

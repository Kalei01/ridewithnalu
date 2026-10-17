/**
 * Makes page-to-page View Transitions safe on phones. The router calls
 * document.startViewTransition() and only awaits `updateCallbackDone`; when
 * Safari aborts the animation (tab hidden, layout not ready, a second
 * navigation interrupts) the `ready` / `finished` promises reject with an
 * InvalidStateError that nobody handles. The page still updates, so the error
 * is harmless, but it floods error reports. Here we (1) skip the animation
 * when the tab is hidden or the rider prefers reduced motion, running the page
 * update directly, and (2) swallow rejections of the animation-only promises.
 */
type Update = (() => unknown) | { update?: () => unknown; types?: string[] };

export function installSafeViewTransitions(
  doc: Document | undefined = typeof document === "undefined" ? undefined : document,
) {
  if (!doc) return;
  const d = doc as unknown as {
    startViewTransition?: ((arg?: Update) => unknown) & { __naluSafe?: boolean };
  };
  const original = d.startViewTransition;
  if (typeof original !== "function" || original.__naluSafe) return;

  const run = (arg?: Update) => {
    const fn = typeof arg === "function" ? arg : arg?.update;
    return Promise.resolve().then(() => fn?.());
  };

  const safe = function (this: unknown, arg?: Update) {
    let skip = doc.visibilityState === "hidden";
    try {
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) skip = true;
    } catch {
      /* ignore */
    }
    if (!skip) {
      try {
        const transition = original.call(doc, arg) as {
          ready?: Promise<unknown>;
          finished?: Promise<unknown>;
        };
        transition.ready?.catch(() => undefined);
        transition.finished?.catch(() => undefined);
        return transition;
      } catch {
        /* fall through to a plain update */
      }
    }
    const done = run(arg);
    return {
      updateCallbackDone: done,
      ready: Promise.resolve(),
      finished: done,
      skipTransition() {},
    };
  } as typeof d.startViewTransition & { __naluSafe?: boolean };
  safe!.__naluSafe = true;
  d.startViewTransition = safe;
}

/** The exact benign Safari abort, which we also drop from error reports. */
export function isBenignViewTransitionAbort(type?: string, value?: string) {
  return (
    type === "InvalidStateError" &&
    typeof value === "string" &&
    value.includes("Transition was aborted")
  );
}

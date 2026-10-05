/**
 * Whether this browser has already seen Nalu's welcome introduction. The
 * first signed-out visit to "/" shows the introduction, and it stays on "/"
 * for the rest of that browsing session (so Back from a linked page returns to
 * it) until the person opens the app. Later visits open the app straight away.
 */
export const WELCOME_SEEN_KEY = "nalu-welcome-seen-v1";
/** Session flag: the introduction is still open in this tab. */
const INTRO_OPEN_KEY = "nalu-intro-open";

/** The person chose to open the app (Start planning, Browse, Open Nalu…). */
export function markWelcomeSeen(): void {
  try {
    window.localStorage.setItem(WELCOME_SEEN_KEY, "1");
    window.sessionStorage.removeItem(INTRO_OPEN_KEY);
  } catch {
    /* private mode: the gate treats unreadable storage as seen */
  }
}

/** The introduction was shown on "/": skip it next visit, keep it for this session. */
export function markIntroductionShown(): void {
  try {
    window.localStorage.setItem(WELCOME_SEEN_KEY, "1");
    window.sessionStorage.setItem(INTRO_OPEN_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** Whether "/" should open the app rather than the introduction. Unreadable storage counts as seen. */
export function hasSeenWelcome(): boolean {
  try {
    return (
      window.localStorage.getItem(WELCOME_SEEN_KEY) === "1" &&
      window.sessionStorage.getItem(INTRO_OPEN_KEY) !== "1"
    );
  } catch {
    return true;
  }
}

export const RETURNING_ATTRIBUTE = "data-nalu-returning";

/**
 * Runs in <head> before the page paints, with the same rule as hasSeenWelcome.
 * A returning visitor, or someone opening a shared trip link, gets the loading
 * screen instead of a flash of the introduction while the app starts.
 */
export const RETURNING_VISITOR_SCRIPT = `try{if((localStorage.getItem("${WELCOME_SEEN_KEY}")==="1"&&sessionStorage.getItem("${INTRO_OPEN_KEY}")!=="1")||new URLSearchParams(location.search).has("to"))document.documentElement.setAttribute("${RETURNING_ATTRIBUTE}","")}catch(e){}`;

/** True when the introduction is on screen but hidden by the head script. */
export function introductionHidden(): boolean {
  return document.documentElement.hasAttribute(RETURNING_ATTRIBUTE);
}

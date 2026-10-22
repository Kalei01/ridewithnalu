import { useCallback, useEffect, useState } from "react";

/**
 * The switch for the Browse redesign. While false, "/" keeps the old Browse screen
 * (src/components/commute/BrowseScreen.tsx, untouched) and the sheet lives at
 * /browse-preview. Flipping this to true would make the sheet the Browse for everyone;
 * flipping it back to false is the whole revert.
 *
 * Until then a rider can opt in on one device: the owner-only developer panel
 * ("New Browse (preview)"). The choice is a localStorage flag, read after mount so the server and first client render agree.
 */
export const BROWSE_SHEET_AT_HOME = false;

const OPT_IN_KEY = "nalu-browse-sheet-v1";
const OPT_IN_EVENT = "nalu-browse-sheet-change";

export function readBrowseSheetOptIn(): boolean {
  try {
    return window.localStorage.getItem(OPT_IN_KEY) === "1";
  } catch {
    return false;
  }
}

export function setBrowseSheetOptIn(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(OPT_IN_KEY, "1");
    else window.localStorage.removeItem(OPT_IN_KEY);
  } catch {
    /* blocked storage: the choice just is not remembered */
  }
  window.dispatchEvent(new Event(OPT_IN_EVENT));
}

/** True when the sheet Browse should show: the global switch, or this device opted in. */
export function useBrowseSheetOptIn(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const read = () => setOn(readBrowseSheetOptIn());
    read();
    window.addEventListener(OPT_IN_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(OPT_IN_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);
  return BROWSE_SHEET_AT_HOME || on;
}

/** Stable callback for the "Back to current Browse" control. */
export function useLeaveBrowseSheet() {
  return useCallback(() => {
    setBrowseSheetOptIn(false);
    if (window.location.pathname.startsWith("/browse-preview")) window.location.assign("/");
  }, []);
}

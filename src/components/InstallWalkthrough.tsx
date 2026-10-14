import "./install-walkthrough.css";
import { EllipsisVertical, Share } from "lucide-react";
import { useReveal } from "@/hooks/use-reveal";

const COPY = {
  ios: {
    label:
      "Illustration: tap Share in Safari, tap Add to Home Screen, and Nalu appears on your Home Screen.",
    rows: ["Copy", "Add to Bookmarks", "Add to Home Screen"],
    pick: 2,
  },
  android: {
    label:
      "Illustration: tap the menu in Chrome, tap Install app, and Nalu appears on your Home screen.",
    rows: ["New tab", "Install app", "Settings"],
    pick: 1,
  },
} as const;

/**
 * A short picture of the install steps for one platform: tap the share/menu
 * button, tap the install row, Nalu lands on the Home Screen. Plays once when it
 * scrolls into view and rests on the last frame; static under reduced motion.
 * The written steps beside it stay the real instructions.
 */
export function InstallWalkthrough({ platform }: { platform: "ios" | "android" }) {
  const ref = useReveal<HTMLElement>();
  const copy = COPY[platform];
  return (
    <figure
      ref={ref}
      className="install-walk"
      data-platform={platform}
      role="img"
      aria-label={copy.label}
    >
      <div className="install-walk__phone" aria-hidden="true">
        <div className="install-walk__scene install-walk__scene--1">
          <div className="install-walk__page">
            <span />
            <span />
            <span />
          </div>
          {platform === "ios" ? (
            <div className="install-walk__bar install-walk__bar--bottom">
              <Share className="install-walk__tap" size={18} />
            </div>
          ) : (
            <div className="install-walk__bar install-walk__bar--top">
              <span className="install-walk__url" />
              <EllipsisVertical className="install-walk__tap" size={18} />
            </div>
          )}
        </div>
        <div className="install-walk__scene install-walk__scene--2">
          <div className="install-walk__page">
            <span />
            <span />
          </div>
          <ul className="install-walk__menu">
            {copy.rows.map((row, i) => (
              <li key={row} data-pick={i === copy.pick ? "true" : "false"}>
                {row}
              </li>
            ))}
          </ul>
        </div>
        <div className="install-walk__scene install-walk__scene--3">
          <div className="install-walk__grid">
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <span key={n} className="install-walk__ghost" />
            ))}
            <span className="install-walk__app">
              <img src="/icons/nalu-icon.svg" alt="" width={36} height={36} />
              <small>Nalu</small>
            </span>
          </div>
        </div>
      </div>
    </figure>
  );
}

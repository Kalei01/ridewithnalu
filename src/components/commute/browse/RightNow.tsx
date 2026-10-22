import { ChevronRight } from "lucide-react";
import type { MapFocus, RightNow, RightNowItem } from "@/lib/browse-right-now";

/**
 * "Right now" leads the Browse sheet: what is happening on the roads this rider
 * depends on. Closed sheet: one line. Open: up to three items, each tappable
 * (the map flies to it). Calm days are one line, not an empty card.
 */

const DOT: Record<RightNowItem["tone"] | "calm" | "wait", string> = {
  bad: "bg-destructive",
  warn: "bg-warning",
  info: "bg-primary",
  calm: "nh-live-dot",
  wait: "bg-muted-foreground/60",
};

/** The one-line form, for the closed sheet. */
export function RightNowLine({ now, onOpen }: { now: RightNow; onOpen: () => void }) {
  const tone =
    now.status === "items" ? now.items[0]!.tone : now.status === "calm" ? "calm" : "wait";
  const more = now.items.length - 1;
  return (
    <button
      type="button"
      className="nb-now-line"
      onClick={onOpen}
      aria-label={`Right now: ${now.line}. Show details`}
    >
      <span className={`nb-now-dot ${DOT[tone]}`} aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
        {now.line}
      </span>
      {more > 0 && (
        <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
          +{more}
        </span>
      )}
    </button>
  );
}

/** The open form: the one line when calm, otherwise the ranked items. */
export function RightNowBlock({
  now,
  activeId,
  onFocus,
}: {
  now: RightNow;
  activeId: string | null;
  onFocus: (item: RightNowItem, focus: MapFocus | null) => void;
}) {
  return (
    <section aria-label="Right now" className="nb-now">
      <h2 className="nb-card-title">Right now</h2>
      {now.status !== "items" ? (
        <p className="nb-now-calm" role="status">
          <span
            className={`nb-now-dot ${DOT[now.status === "calm" ? "calm" : "wait"]}`}
            aria-hidden="true"
          />
          <span className="min-w-0 text-sm font-semibold text-foreground">{now.line}</span>
        </p>
      ) : (
        <ul className="nb-now-list">
          {now.items.map((item) => {
            const body = (
              <>
                <span className={`nb-now-dot mt-1.5 ${DOT[item.tone]}`} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">{item.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {item.detail}
                    {item.detail ? " · " : ""}
                    {item.source}
                  </span>
                </span>
                {item.focus && (
                  <ChevronRight
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                )}
              </>
            );
            return (
              <li key={item.id}>
                {item.focus ? (
                  <button
                    type="button"
                    className="nb-now-item"
                    aria-current={activeId === item.id ? "true" : undefined}
                    aria-label={`${item.title}. ${item.detail}. Show on the map`}
                    onClick={() => onFocus(item, item.focus)}
                  >
                    {body}
                  </button>
                ) : (
                  <div className="nb-now-item">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

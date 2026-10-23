import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, Construction, X } from "lucide-react";
import type { MapFocus, RightNow, RightNowItem, TrafficCardData } from "@/lib/browse-right-now";

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
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">{now.line}</span>
        {now.status === "items" && now.items[0]!.detail && (
          <span className="block truncate text-xs text-muted-foreground">
            {now.items[0]!.detail}
          </span>
        )}
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
                <ChevronRight
                  aria-hidden="true"
                  className="mt-1 size-4 shrink-0 text-muted-foreground"
                />
              </>
            );
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className="nb-now-item"
                  aria-current={activeId === item.id ? "true" : undefined}
                  aria-label={`${item.title}. ${item.detail}. ${item.focus ? "Show on the map" : "Show details"}`}
                  onClick={() => onFocus(item, item.focus)}
                >
                  {body}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * The card for one Right now item (a crash, slowdown, police report or closure):
 * what, where, when, and who said so. It takes the top of the sheet until closed.
 */
export function ItemCard({ item, onClose }: { item: RightNowItem; onClose: () => void }) {
  return (
    <section className="nb-select-card nh-card p-4" aria-label={item.title}>
      <div className="flex items-start gap-3">
        <span className={`nb-now-dot mt-2 ${DOT[item.tone]}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
            {item.kind === "closure"
              ? "Road closure"
              : item.kind === "slowdown"
                ? "Slowdown"
                : "Incident"}
          </p>
          <p className="mt-0.5 break-words text-lg font-semibold leading-snug text-foreground">
            {item.title}
          </p>
          {item.detail && <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>}
          <p className="mt-2 text-xs text-muted-foreground">Source: {item.source}</p>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="-mr-1 -mt-1 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-white/10"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
    </section>
  );
}

/** The card for a tapped road segment: road and way, the stretch, the level, the provider's numbers. */
export function TrafficCard({ card, onClose }: { card: TrafficCardData; onClose: () => void }) {
  return (
    <section className="nb-select-card nh-card p-4" aria-label={card.title}>
      <div className="flex items-start gap-3">
        <span className={`nb-now-dot mt-2 ${DOT[card.tone]}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Traffic
          </p>
          <p className="mt-0.5 break-words text-lg font-semibold leading-snug text-foreground">
            {card.title}
          </p>
          {card.between && <p className="mt-0.5 text-sm text-foreground">{card.between}</p>}
          {card.level && <p className="mt-1 text-sm font-semibold text-foreground">{card.level}</p>}
          {card.legs.map((leg) => (
            <p key={leg.label} className="mt-1 text-sm text-foreground">
              {leg.label}
              <span className="text-muted-foreground"> · {leg.text}</span>
            </p>
          ))}
          {card.facts.map((fact) => (
            <p key={fact} className="mt-0.5 text-sm text-muted-foreground">
              {fact}
            </p>
          ))}
          <p className="mt-2 text-xs text-muted-foreground">{card.source}</p>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="-mr-1 -mt-1 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-white/10"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
    </section>
  );
}

/**
 * The state's weekly lane closures on the rider's roads, kept out of the way:
 * one row, "Road closures (N)", that opens to the full list. Each opens its card.
 */
export function RoadClosuresRow({
  items,
  weekCount,
  activeId,
  onFocus,
}: {
  items: RightNowItem[];
  /** All planned closures on the state's list this week (island-wide), or null when it did not load. */
  weekCount: number | null;
  activeId: string | null;
  onFocus: (item: RightNowItem, focus: MapFocus | null) => void;
}) {
  const parts = [
    items.length
      ? `${items.length} on roads you use`
      : weekCount === null
        ? "List unavailable right now"
        : "None on roads you use",
    weekCount !== null ? `${weekCount} this week` : null,
  ].filter(Boolean);
  return (
    <details className="nh-card nh-details nb-closures">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <Construction aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
        <span className="min-w-0">
          <span className="block text-base font-bold text-foreground">Road closures</span>
          <span className="block text-sm text-muted-foreground">{parts.join(" · ")}</span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className="nh-chevron ml-auto size-4 text-muted-foreground"
        />
      </summary>
      <ul className="nb-now-list">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="nb-now-item"
              aria-current={activeId === item.id ? "true" : undefined}
              aria-label={`${item.title}. ${item.detail}. Show details`}
              onClick={() => onFocus(item, item.focus)}
            >
              <span className={`nb-now-dot mt-1.5 ${DOT[item.tone]}`} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">{item.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {item.detail}
                  {item.detail ? " · " : ""}
                  {item.source}
                </span>
              </span>
              <ChevronRight
                aria-hidden="true"
                className="mt-1 size-4 shrink-0 text-muted-foreground"
              />
            </button>
          </li>
        ))}
      </ul>
      <Link
        to="/roadwork"
        className="flex min-h-11 items-center gap-1 border-t border-white/10 px-4 text-sm font-semibold text-primary"
      >
        See all roadwork this week <ChevronRight aria-hidden="true" className="size-4" />
      </Link>
    </details>
  );
}

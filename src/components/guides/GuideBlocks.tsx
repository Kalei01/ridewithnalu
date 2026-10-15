import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { SkylineMap, type SkylineMapPin, type SkylineMapView } from "./SkylineMap";
import "@/components/home/home.css";
import "./skyline-parking.css";

/**
 * Shared building blocks for the guide pages, in the home / Skyline-guide look
 * (hairline card, soft blue glow, big numbers). Everything is plain server-
 * rendered markup; no script, no state. The text always carries the facts:
 * nothing here is a picture that only the eye can read.
 */

export type StatItem = {
  /** Small label under (or beside) the number: the "from" or "what". */
  label: ReactNode;
  /** The big figure, like "32" or "Free". */
  value: string;
  /** Small unit after the figure, like "min". */
  unit?: string;
  /** A short hedge before the figure, like "About". */
  prefix?: string;
  /** One quiet line of detail. */
  note?: ReactNode;
};

/**
 * "What to know" strip or a minutes grid: a few big figures with labels,
 * two to a row on a phone, three to a row on wider screens.
 */
export function StatTiles({ items, label }: { items: StatItem[]; label: string }) {
  return (
    <section aria-label={label}>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((item, i) => (
          <li
            key={i}
            className={`sg-card flex flex-col justify-between gap-1 p-4 ${
              items.length % 2 === 1 && i === items.length - 1 ? "col-span-2 sm:col-span-1" : ""
            }`}
          >
            <span className="text-sm leading-5 text-muted-foreground">{item.prefix}</span>
            <span className="flex flex-wrap items-baseline gap-x-1.5">
              <span className={`sg-stalls ${item.value.length > 5 ? "!text-2xl" : "!text-3xl"}`}>
                {item.value}
              </span>
              {item.unit && (
                <span className="text-base font-semibold text-foreground">{item.unit}</span>
              )}
            </span>
            <span className="text-base leading-6 text-foreground">{item.label}</span>
            {item.note && (
              <span className="text-sm leading-5 text-muted-foreground">{item.note}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export type OptionItem = {
  title: ReactNode;
  /** Big figure or phrase, like "55 to 60" or "Free". */
  big: string;
  unit?: string;
  /** Optional small tag, like "Weekdays". */
  pill?: string;
  detail: ReactNode;
};

/** One card per option (drive / Skyline plus bus / bus ...), with the main figure big. */
export function OptionCards({ options }: { options: OptionItem[] }) {
  return (
    <ul className="grid gap-4">
      {options.map((o, i) => (
        <li key={i} className="sg-card p-4 text-base leading-7 text-muted-foreground sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <h3 className="text-lg font-bold leading-tight text-foreground">{o.title}</h3>
            {o.pill && <span className="sg-pill">{o.pill}</span>}
          </div>
          <p className="mt-2 flex items-baseline gap-2">
            <span className={`sg-stalls ${o.big.length > 9 ? "!text-2xl" : "!text-3xl"}`}>
              {o.big}
            </span>
            {o.unit && <span className="text-base font-semibold text-foreground">{o.unit}</span>}
          </p>
          <p className="mt-2">{o.detail}</p>
        </li>
      ))}
    </ul>
  );
}

/** Long lists and extras: closed by default, with the same chevron as the FAQ. */
export function GuideDetails({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="sg-card group">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 text-base font-semibold text-foreground [&::-webkit-details-marker]:hidden">
        <span className="flex-1">{title}</span>
        <ChevronDown
          className="size-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </summary>
      <div className="grid gap-3 px-4 pb-4 text-base leading-7 text-muted-foreground">
        {children}
      </div>
    </details>
  );
}

/** The static Skyline map in its glow frame (see SkylineMap for the pin options). */
export function GuideMap({
  pins,
  title,
  caption,
  view,
  showAllStations = true,
}: {
  pins: SkylineMapPin[];
  title: string;
  caption: string;
  view?: SkylineMapView;
  showAllStations?: boolean;
}) {
  return (
    <figure className="sg-map">
      <SkylineMap
        pins={pins}
        title={title}
        showAllStations={showAllStations}
        {...(view ? { view } : {})}
      />
      <figcaption className="sr-only">{caption}</figcaption>
    </figure>
  );
}

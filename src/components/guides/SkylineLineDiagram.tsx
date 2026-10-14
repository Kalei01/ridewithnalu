import "./skyline-line.css";
import { useReveal } from "@/hooks/use-reveal";

/** Station order, English then Hawaiian (docs/product/direction.md), minutes from East Kapolei (TheBus timetable, as in the rail guide table) and the city's park-and-ride stall counts. */
const LINE: ReadonlyArray<{ english: string; hawaiian: string; minutes: number; stalls?: number }> =
  [
    { english: "East Kapolei", hawaiian: "Kualakaʻi", minutes: 0 },
    { english: "UH West Oʻahu", hawaiian: "Keoneʻae", minutes: 2, stalls: 304 },
    { english: "Hoʻopili", hawaiian: "Honouliuli", minutes: 4, stalls: 344 },
    { english: "West Loch", hawaiian: "Hōʻaeʻae", minutes: 7 },
    { english: "Waipahu Transit Center", hawaiian: "Pouhala", minutes: 10 },
    { english: "Leeward Community College", hawaiian: "Halaulani", minutes: 13 },
    { english: "Pearl Highlands", hawaiian: "Waiawa", minutes: 14 },
    { english: "Pearlridge", hawaiian: "Kalauao", minutes: 18 },
    { english: "Aloha Stadium", hawaiian: "Hālawa", minutes: 22, stalls: 590 },
    { english: "Joint Base Pearl Harbor–Hickam", hawaiian: "Makalapa", minutes: 24 },
    { english: "Daniel K. Inouye International Airport", hawaiian: "Lelepaua", minutes: 28 },
    { english: "Lagoon Drive", hawaiian: "Ahua", minutes: 32 },
    { english: "Kalihi Transit Center", hawaiian: "Kahauiki", minutes: 34, stalls: 95 },
  ];

/**
 * The Skyline line as a list of stations that light up in order when it scrolls
 * into view. "line" shows minutes between stations; "parking" lights only the
 * four park-and-ride stations and shows their stalls. Static under reduced motion.
 */
export function SkylineLineDiagram({ mode }: { mode: "line" | "parking" }) {
  const ref = useReveal<HTMLElement>();
  const parking = mode === "parking";
  return (
    <figure ref={ref} className="skyline-line rounded-2xl border border-border bg-card/60 p-4">
      <ol className="skyline-line__list">
        {LINE.map((s, i) => {
          const lit = !parking || s.stalls !== undefined;
          return (
            <li
              key={s.english}
              className="skyline-line__row"
              data-lit={lit ? "true" : "false"}
              style={{ "--i": i } as React.CSSProperties}
            >
              <svg className="skyline-line__mark" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="skyline-line__dot" cx="12" cy="12" r={s.stalls ? 9 : 6} />
                {s.stalls ? (
                  <text className="skyline-line__p" x="12" y="16" textAnchor="middle">
                    P
                  </text>
                ) : null}
              </svg>
              <span className="skyline-line__name">
                <span className="font-semibold">{s.english}</span>{" "}
                <span className="text-muted-foreground">{s.hawaiian}</span>
              </span>
              <span className="skyline-line__meta text-muted-foreground">
                {parking
                  ? s.stalls
                    ? `${s.stalls} stalls`
                    : ""
                  : i === 0
                    ? "Start"
                    : `${s.minutes} min`}
              </span>
            </li>
          );
        })}
      </ol>
      <figcaption className="mt-3 text-base leading-7 text-muted-foreground">
        {parking
          ? "The four free park-and-ride stations along Skyline, with the city's stall counts."
          : "Skyline's 13 stations, west to east, with minutes from East Kapolei (TheBus timetable). P marks a free park-and-ride lot."}
      </figcaption>
    </figure>
  );
}

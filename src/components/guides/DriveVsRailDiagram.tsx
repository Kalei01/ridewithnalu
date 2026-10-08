/**
 * A simple picture of the choice every trip guide is about: the drive follows
 * H-1 traffic, the train follows the timetable. No times or numbers, so it
 * never goes out of date; the facts stay in the text. Static (no motion).
 */
export function DriveVsRailDiagram() {
  return (
    <figure className="rounded-2xl border border-border bg-card/60 p-4">
      <svg
        viewBox="0 0 320 150"
        role="img"
        aria-labelledby="dvr-title dvr-desc"
        className="h-auto w-full"
      >
        <title id="dvr-title">Driving on H-1 compared with Skyline and TheBus</title>
        <desc id="dvr-desc">
          Two routes from your start to your destination. The drive on H-1 changes with traffic. The
          Skyline train follows its timetable, then you may finish on TheBus.
        </desc>
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M28 42 H292" stroke="currentColor" strokeWidth="6" className="text-muted-foreground/50" />
          <path d="M60 42 H110 M150 42 H200" stroke="currentColor" strokeWidth="2" strokeDasharray="2 10" className="text-background" />
          <path d="M28 108 H210" stroke="currentColor" strokeWidth="6" className="text-primary" />
          <path d="M210 108 H292" stroke="currentColor" strokeWidth="4" strokeDasharray="1 9" className="text-primary" />
        </g>
        <g fill="currentColor" className="text-foreground">
          <circle cx="28" cy="42" r="8" />
          <circle cx="292" cy="42" r="8" />
          <circle cx="28" cy="108" r="8" />
          <circle cx="292" cy="108" r="8" />
          <circle cx="210" cy="108" r="6" className="text-primary" />
        </g>
        <g fill="currentColor" className="text-foreground" fontSize="13" fontWeight="600">
          <text x="28" y="20">Drive on H-1</text>
          <text x="28" y="86">Skyline</text>
          <text x="188" y="134">then TheBus if needed</text>
        </g>
        <g fill="currentColor" className="text-muted-foreground" fontSize="12">
          <text x="292" y="20" textAnchor="end">changes with traffic</text>
          <text x="292" y="86" textAnchor="end">runs on schedule</text>
        </g>
      </svg>
      <figcaption className="mt-2 text-base leading-7 text-muted-foreground">
        The road time moves with traffic; the train leg does not. Nalu compares both for your exact trip.
      </figcaption>
    </figure>
  );
}

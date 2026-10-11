import { stationLabel } from "@/lib/commute-formatting";
import { skylineStationParts } from "@/lib/rail/station-names";

/**
 * A Skyline station name that stands on its own: the English name, with the
 * Hawaiian name under it in smaller muted text. Other names print as before.
 * Inside a sentence, use stationLabel() ("English (Hawaiian)") instead.
 */
export function StationName({
  name,
  className = "",
  hawaiianClassName = "text-xs font-normal",
}: {
  name: string | null | undefined;
  className?: string;
  hawaiianClassName?: string;
}) {
  const parts = skylineStationParts(name);
  if (!parts) return <span className={className}>{stationLabel(name)}</span>;
  return (
    <span className={`flex min-w-0 flex-col ${className}`}>
      <span className="min-w-0 break-words">{parts.english}</span>
      <span className={`min-w-0 break-words text-muted-foreground ${hawaiianClassName}`}>
        {parts.hawaiian}
      </span>
    </span>
  );
}

import { Car, TrainFront } from "lucide-react";
import { formatDriveMinutes } from "@/lib/drive/traffic-summary";

type Row = {
  label: string;
  minutes: number | null;
  low?: number | undefined;
  high?: number | undefined;
};

/** Both bars use one duration scale so the comparison is honest at a glance. */
export function DecisionBars({ drive, transit }: { drive: Row; transit: Row }) {
  const scale = Math.max(1, drive.minutes ?? 0, transit.minutes ?? 0);
  return (
    <div
      className="mt-6 space-y-4 border-t border-border/50 pt-5"
      aria-label="Travel time comparison"
    >
      <p className="text-[11px] text-muted-foreground">Time from now to your destination</p>
      {([drive, transit] as const).map((row, index) => {
        const Icon = index === 0 ? Car : TrainFront;
        return (
          <div
            key={row.label}
            className="grid grid-cols-[4.5rem_minmax(0,1fr)_3.5rem] items-center gap-3"
          >
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Icon className="size-4" />
              {row.label}
            </span>
            <div
              className="h-2.5 overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`${row.label}: ${row.minutes === null ? "unavailable" : `${row.minutes} minutes`}`}
            >
              {row.minutes !== null && (
                <div
                  className={`h-full rounded-full ${index === 0 ? "bg-primary" : "bg-location"}`}
                  style={{ width: `${Math.max(3, (row.minutes / scale) * 100)}%` }}
                />
              )}
            </div>
            <span
              className="text-right text-sm font-semibold tabular-nums"
              title={
                row.low !== undefined && row.high !== undefined
                  ? `Typical range ${row.low}–${row.high} min`
                  : undefined
              }
            >
              {row.minutes === null ? "—" : formatDriveMinutes(row.minutes)}
              {row.minutes !== null && row.low !== undefined && row.high !== undefined && (
                <span className="block text-[10px] font-normal text-muted-foreground">
                  {formatDriveMinutes(row.low)}–{formatDriveMinutes(row.high)}
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

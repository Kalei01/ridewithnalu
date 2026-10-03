import type { ReactNode } from "react";

type DriveDetailsProps = {
  tripOriginLabel: string;
  tripArrivalLabel: string;
  driveMinutes: number | null;
  driveLoading: boolean;
  driveAvailable: boolean;
  content: ReactNode;
};

export function DriveDetails({
  tripOriginLabel,
  tripArrivalLabel,
  driveMinutes,
  driveLoading,
  driveAvailable,
  content,
}: DriveDetailsProps) {
  return (
    <div className="nalu-card-surface mt-6 rounded-2xl border border-border p-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-foreground">Drive details</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {tripOriginLabel} to {tripArrivalLabel}
          </p>
        </div>
        <p className="text-4xl font-bold tabular-nums text-foreground">
          {driveAvailable
            ? driveMinutes !== null
              ? Math.round(driveMinutes)
              : driveLoading
                ? "…"
                : "—"
            : "—"}
          <span className="ml-1 text-base">min</span>
        </p>
      </div>
      {content}
    </div>
  );
}

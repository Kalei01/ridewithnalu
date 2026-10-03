import type { ReactNode } from "react";

type DriveDetailsProps = {
  content: ReactNode;
  /** Legacy presentation props retained for route compatibility during cleanup. */
  tripOriginLabel?: string;
  tripArrivalLabel?: string;
  driveMinutes?: number | null;
  driveLoading?: boolean;
  driveAvailable?: boolean;
};

/** Presentation-only shell. The route owns the complete card content so the DOM stays identical to the pre-refactor version. */
export function DriveDetails({ content }: DriveDetailsProps) {
  return <div className="nalu-card-surface mt-6 rounded-2xl border border-border p-5">{content}</div>;
}

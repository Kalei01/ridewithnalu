/**
 * Nalu Intelligence Core — provider-neutral contracts.
 *
 * This file intentionally contains contracts only. Existing routing, transit,
 * weather, incident, and AI implementations remain the source adapters until
 * each capability is migrated and regression-tested.
 */

export type MobilityMode = "drive" | "rail" | "bus" | "walk";

export type TimeConstraint =
  | {
      kind: "depart-at";
      timestamp: string;
    }
  | {
      kind: "arrive-by";
      timestamp: string;
    }
  | {
      kind: "now";
    };

export type GeoPoint = {
  lat: number;
  lon: number;
};

export type TripRequest = {
  origin: GeoPoint;
  destination: GeoPoint;
  timeConstraint: TimeConstraint;
  availableModes: MobilityMode[];
  requestedAt: string;
  userConstraints?: {
    avoidModes?: MobilityMode[];
  };
};

export type EvidenceFreshness = {
  observedAt: string;
  /** Provider/source that produced the observation. */
  source: string;
  /** Optional age in seconds when the source supplies an observation time. */
  ageSeconds?: number;
};

export type DriveEvidence = {
  mode: "drive";
  travelMinutes: number;
  typicalMinutes?: number | null;
  delayMinutes?: number | null;
  freshness: EvidenceFreshness;
};

export type TransitEvidence = {
  mode: "rail" | "bus";
  travelMinutes: number;
  arrivalTime?: string | null;
  departureTime?: string | null;
  scheduled: boolean;
  liveObservation: boolean;
  freshness: EvidenceFreshness;
};

export type IncidentEvidence = {
  description: string;
  road?: string | null;
  impactMinutes?: number | null;
  freshness: EvidenceFreshness;
};

export type WeatherEvidence = {
  summary: string;
  precipitationPercent?: number | null;
  freshness: EvidenceFreshness;
};

export type MobilitySnapshot = {
  capturedAt: string;
  drive?: DriveEvidence | null;
  transit: TransitEvidence[];
  incidents: IncidentEvidence[];
  weather?: WeatherEvidence | null;
};

export type DecisionReason = {
  text: string;
  /** Evidence identifiers are optional until source IDs are available. */
  evidence?: string[];
};

export type NaluDecision = {
  selectedMode: MobilityMode | null;
  alternatives: MobilityMode[];
  departureTime?: string | null;
  arrivalTime?: string | null;
  reasons: DecisionReason[];
  warnings: string[];
  freshness: EvidenceFreshness[];
  /**
   * Confidence is only present when Nalu has enough evidence to justify it.
   * The core must never manufacture confidence from an arbitrary ETA range.
   */
  confidence?: "high" | "medium" | "low";
};

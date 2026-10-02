/**
 * Nalu Intelligence Core — provider-neutral contracts.
 *
 * Existing providers remain adapters. The canonical trip/route model in
 * trip-model.ts represents the concrete sequence of route segments used by
 * maps, navigation, and commute details.
 */
export type MobilityMode = "drive" | "rail" | "bus" | "walk";

export type TimeConstraint =
  | { kind: "depart-at"; timestamp: string }
  | { kind: "arrive-by"; timestamp: string }
  | { kind: "now" };

export type GeoPoint = { lat: number; lon: number };

export type TripRequest = {
  origin: GeoPoint;
  destination: GeoPoint;
  timeConstraint: TimeConstraint;
  availableModes: MobilityMode[];
  requestedAt: string;
  userConstraints?: { avoidModes?: MobilityMode[] };
};

export type EvidenceFreshness = {
  observedAt: string;
  source: string;
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
  evidence?: string[];
};

export type NaluDecision = {
  decisionState: "drive" | "transit" | "same" | "none" | "uncertain";
  selectedMode: MobilityMode | null;
  alternatives: MobilityMode[];
  departureTime?: string | null;
  arrivalTime?: string | null;
  reasons: DecisionReason[];
  warnings: string[];
  freshness: EvidenceFreshness[];
  confidence?: "high" | "medium" | "low";
};

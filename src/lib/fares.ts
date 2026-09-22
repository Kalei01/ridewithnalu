/**
 * HOLO card fare facts for Oahu transit (TheBus + Skyline).
 * Shown as a subtle notice on transit itineraries so visitors and
 * infrequent riders know what to expect before boarding.
 */
export const HOLO_FARES = {
  /** Single ride paid with a HOLO card. */
  singleRide: "$3.00",
  /** Free transfers between TheBus and Skyline within this window. */
  transferWindowHours: 2.5,
  /** Cash fare on TheBus (exact change); no transfers, not accepted at Skyline gates. */
  cashFare: "$3.25",
  /** Daily fare cap with a HOLO card. */
  dailyCap: "$7.50",
  /** Single ride for Kūpuna / seniors 65+ with a Senior HOLO card. */
  seniorRide: "$1.25",
  /** Daily cap for Kūpuna / seniors 65+ with a Senior HOLO card. */
  seniorDailyCap: "$3.00",
} as const;

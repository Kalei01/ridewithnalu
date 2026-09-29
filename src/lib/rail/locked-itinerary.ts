import { z } from "zod";

const leg = z.object({
  kind: z.enum(["access", "rail", "connect", "egress"]),
  mode: z.enum(["walk", "drive", "bus", "rail"]),
  route_short: z.string().nullable(),
  route_long: z.string().nullable(),
  headsign: z.string().nullable(),
  from: z.string().nullable(),
  to: z.string().nullable(),
  from_stop_id: z.string().nullable().optional(),
  to_stop_id: z.string().nullable().optional(),
  depart_seconds: z.number().finite().nullable(),
  arrive_seconds: z.number().finite().nullable(),
  minutes: z.number().finite().nullable(),
});

const itinerary = z.object({
  leave_by_seconds: z.number().finite(),
  depart_seconds: z.number().finite(),
  arrive_seconds: z.number().finite(),
  total_minutes: z.number().finite().nonnegative(),
  legs: z.array(leg).min(1).max(12),
});

export function parseLockedItinerary(raw: string | null): z.infer<typeof itinerary> | null {
  if (!raw) return null;
  try {
    return itinerary.safeParse(JSON.parse(raw)).data ?? null;
  } catch {
    return null;
  }
}

import { createServerFn } from "@tanstack/react-start";
import { rateLimit } from "./rate-limit.server";
import type { HpdPin } from "./drive/hpd-incidents";

const islandLimit = rateLimit("hpd-island", 60);

export type HpdIslandResult = {
  /** Placed police reports from the last 3 hours, newest first. Each carries its confidence, soft radius and direction. */
  pins: HpdPin[];
  /** The police feed answered with something current. False means "unknown", never "no reports". */
  checked: boolean;
  /** Plain line for tooltips / diagnostics: "placed 14 of 18 (exact 9, approximate 5)". */
  placement: string | null;
  attribution: string;
};

/**
 * Every recent police report placed on Oʻahu, for the Browse map. Shares the 5-minute
 * feed cache with the drive answers, so any number of map viewers cost one feed read.
 * Never throws: on any failure it answers `checked: false` with no pins.
 */
export const getHpdIslandPins = createServerFn({ method: "GET" })
  .middleware([islandLimit])
  .handler(async (): Promise<HpdIslandResult> => {
    const { hpdIsland } = await import("./drive/hpd-incidents");
    return hpdIsland();
  });

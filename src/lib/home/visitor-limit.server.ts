import { createRateLimiter } from "@/lib/rate-limit";

/**
 * A per-visitor backstop for the home page's public endpoints: far above what
 * a person's page does (one check every 2 minutes), it stops scripts looping.
 */
export function visitorLimit(max: number, windowMs = 60_000) {
  const allow = createRateLimiter(max, windowMs);
  return (request: Request): boolean => {
    const ip =
      request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    return allow(ip);
  };
}

export const tooMany = () =>
  Response.json(null, {
    status: 429,
    headers: { "cache-control": "no-store", "retry-after": "60" },
  });

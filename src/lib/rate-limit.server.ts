import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createRateLimiter } from "./rate-limit";

/**
 * Guards the server functions that spend paid quota (TomTom, AI). Limits are
 * per visitor and far above what a person does by hand; they stop scripts.
 * Counts live in each server instance, so this is a backstop, not a wall.
 */
export function rateLimit(name: string, max: number, windowMs = 60_000) {
  const allow = createRateLimiter(max, windowMs);
  return createMiddleware({ type: "function" }).server(async ({ next }) => {
    const request = getRequest();
    const ip =
      request?.headers.get("cf-connecting-ip") ??
      request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    if (!allow(`${name}:${ip}`)) {
      throw new Error("Too many requests. Please wait a moment and try again.");
    }
    return next();
  });
}

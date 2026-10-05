/**
 * A small sliding-window counter: at most `max` calls per `windowMs` per key.
 * Pure so it can be tested; the server middleware below keys it by visitor IP.
 */
export function createRateLimiter(max: number, windowMs: number, maxKeys = 5000) {
  const hits = new Map<string, number[]>();
  return function allow(key: string, now = Date.now()): boolean {
    const recent = (hits.get(key) ?? []).filter((at) => now - at < windowMs);
    if (recent.length >= max) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    // Forget the oldest visitors so memory stays small.
    if (hits.size > maxKeys) {
      const oldest = hits.keys().next().value;
      if (oldest !== undefined) hits.delete(oldest);
    }
    return true;
  };
}

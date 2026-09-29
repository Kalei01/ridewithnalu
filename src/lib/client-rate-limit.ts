/** A small per-view guard against accidental repeated client requests. */
export function createClientRateWindow(intervalMs: number) {
  let nextAllowedAt = 0;
  return {
    remainingMs(now: number) {
      return Math.max(0, nextAllowedAt - now);
    },
    tryAcquire(now: number) {
      if (now < nextAllowedAt) return false;
      nextAllowedAt = now + intervalMs;
      return true;
    },
  };
}

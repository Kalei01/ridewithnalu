/**
 * Where a phone first came from: the ?ref= tag on links Nalu shares
 * (ridenalu.com/?ref=west), or utm_source as a fallback. First tag wins.
 */
const KEY = "nalu-ref-v1";

/** Lowercase letters, digits, - and _ only, up to 32 characters; anything else is ignored. */
export function normalizeRef(value: string | null | undefined): string | null {
  if (!value) return null;
  const ref = value.trim().toLowerCase();
  return /^[a-z0-9_-]{1,32}$/.test(ref) ? ref : null;
}

export function refFromUrl(search: string): string | null {
  const params = new URLSearchParams(search);
  return normalizeRef(params.get("ref")) ?? normalizeRef(params.get("utm_source"));
}

/** Remember this phone's first channel. Returns the stored channel, if any. */
export function captureRef(): string | null {
  try {
    const stored = normalizeRef(window.localStorage.getItem(KEY));
    if (stored) return stored;
    const fresh = refFromUrl(window.location.search);
    if (fresh) window.localStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    return refFromUrl(window.location.search);
  }
}

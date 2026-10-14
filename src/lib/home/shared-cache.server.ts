/**
 * A small shared cache for the home page's public answers. On Cloudflare the
 * answer is kept in the data center's edge cache, so visitors share one check
 * instead of each spending a TomTom or database call; it is also remembered
 * in this server instance, and identical checks in flight are asked once.
 * Outside Cloudflare (local dev, tests) only the in-memory part applies.
 */
type Entry<T> = { at: number; value: T };

const memory = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();
const MAX_ENTRIES = 32;

function edgeCache(): Cache | null {
  const store = (globalThis as { caches?: { default?: Cache } }).caches;
  return store?.default ?? null;
}

const edgeKey = (key: string) =>
  new Request(`https://ridenalu.com/__home-cache/${encodeURIComponent(key)}`);

/** Reads a value no older than `maxAgeMs`, from memory or the edge cache. */
export async function readShared<T>(key: string, maxAgeMs: number): Promise<Entry<T> | null> {
  const local = memory.get(key) as Entry<T> | undefined;
  if (local && Date.now() - local.at < maxAgeMs) return local;
  const edge = edgeCache();
  if (!edge) return null;
  try {
    const hit = await edge.match(edgeKey(key));
    if (!hit) return null;
    const entry = (await hit.json()) as Entry<T>;
    if (Date.now() - entry.at >= maxAgeMs) return null;
    remember(key, entry);
    return entry;
  } catch {
    return null;
  }
}

function remember(key: string, entry: Entry<unknown>) {
  memory.delete(key);
  memory.set(key, entry);
  while (memory.size > MAX_ENTRIES) {
    const oldest = memory.keys().next().value;
    if (typeof oldest !== "string") break;
    memory.delete(oldest);
  }
}

/** Stores a value for `ttlSeconds` (edge) and in memory. */
export async function writeShared<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const entry: Entry<T> = { at: Date.now(), value };
  remember(key, entry);
  const edge = edgeCache();
  if (!edge) return;
  try {
    await edge.put(
      edgeKey(key),
      new Response(JSON.stringify(entry), {
        headers: { "content-type": "application/json", "cache-control": `max-age=${ttlSeconds}` },
      }),
    );
  } catch {
    /* the edge cache is a speed-up only */
  }
}

/** The cached value when fresh enough, otherwise one shared run of `load` (stored when not null). */
export async function sharedAnswer<T>(
  key: string,
  maxAgeMs: number,
  load: () => Promise<T | null>,
): Promise<Entry<T> | null> {
  const cached = await readShared<T>(key, maxAgeMs);
  if (cached) return cached;
  const running = inflight.get(key) as Promise<Entry<T> | null> | undefined;
  if (running) return running;
  const work = (async () => {
    try {
      const value = await load();
      if (value === null) return null;
      await writeShared(key, value, Math.ceil(maxAgeMs / 1000));
      return { at: Date.now(), value };
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, work);
  return work;
}

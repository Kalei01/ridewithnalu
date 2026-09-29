export type DepartingOption = { depart_seconds: number; arrive_seconds: number };

/** Page the existing GTFS planner near a target instead of taking its first eight trains of the day. */
export async function collectArriveByOptions<T extends DepartingOption>(input: {
  nowSeconds: number;
  targetSeconds: number;
  fetchPage: (afterSeconds: number) => Promise<T[]>;
  maxPages?: number;
}): Promise<{ options: T[]; complete: boolean; pages: number }> {
  const maxPages = Math.max(1, Math.min(8, input.maxPages ?? 6));
  let cursor = Math.max(input.nowSeconds, input.targetSeconds - 4 * 3600);
  const found = new Map<string, T>();
  let pages = 0;
  let complete = false;
  while (pages < maxPages && cursor <= input.targetSeconds) {
    const page = await input.fetchPage(cursor);
    pages += 1;
    for (const option of page)
      found.set(`${option.depart_seconds}:${option.arrive_seconds}`, option);
    if (page.some((option) => option.arrive_seconds > input.targetSeconds)) {
      complete = true;
      break;
    }
    const latest = page.reduce((value, option) => Math.max(value, option.depart_seconds), cursor);
    // A page with no viable transfer can still be followed by a later one.
    cursor = page.length > 0 ? Math.max(cursor + 1, latest + 1) : cursor + 15 * 60;
  }
  if (cursor > input.targetSeconds) complete = true;
  return {
    options: [...found.values()].sort((a, b) => a.arrive_seconds - b.arrive_seconds),
    complete,
    pages,
  };
}

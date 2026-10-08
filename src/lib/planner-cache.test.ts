import { beforeEach, describe, expect, it, vi } from "vitest";
import { PLANNER_CACHE_TTL_MS, cachedPlannerSearch, clearPlannerCache } from "./planner-cache";

const T0 = Date.parse("2026-10-08T17:00:00Z"); // 7:00 AM in Honolulu

describe("planner cache", () => {
  beforeEach(() => clearPlannerCache());

  it("runs one search for the same arguments in any key order, sharing one still running", async () => {
    const search = vi.fn(async () => ({ data: [{ n: 1 }], error: null }));
    const [a, b] = await Promise.all([
      cachedPlannerSearch("plan_x", { a: 1, b: 2 }, search, T0),
      cachedPlannerSearch("plan_x", { b: 2, a: 1 }, search, T0 + 1000),
    ]);
    expect(search).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
  });

  it("keys on the function, every argument, and the Honolulu service day", async () => {
    const search = vi.fn(async () => ({ data: [], error: null }));
    await cachedPlannerSearch("plan_x", { a: 1 }, search, T0);
    await cachedPlannerSearch("plan_y", { a: 1 }, search, T0);
    await cachedPlannerSearch("plan_x", { a: 1.0001 }, search, T0);
    // 11:40 PM and 12:20 AM Honolulu are different service days.
    const late = Date.parse("2026-10-09T09:40:00Z");
    await cachedPlannerSearch("plan_x", { a: 1 }, search, late);
    await cachedPlannerSearch("plan_x", { a: 1 }, search, late + 40 * 60_000);
    expect(search).toHaveBeenCalledTimes(5);
  });

  it("remembers nothing around midnight or during the Sunday timetable refresh", async () => {
    const search = vi.fn(async () => ({ data: [], error: null }));
    const at = (iso: string) => Date.parse(iso);
    for (const t of ["2026-10-09T09:55:00Z", "2026-10-09T10:05:00Z", "2026-10-11T12:30:00Z"]) {
      await cachedPlannerSearch("plan_x", {}, search, at(t));
      await cachedPlannerSearch("plan_x", {}, search, at(t));
    }
    expect(search).toHaveBeenCalledTimes(6);
    // A weekday 2 AM is remembered as usual.
    await cachedPlannerSearch("plan_y", {}, search, at("2026-10-08T12:00:00Z"));
    await cachedPlannerSearch("plan_y", {}, search, at("2026-10-08T12:00:00Z"));
    expect(search).toHaveBeenCalledTimes(7);
  });

  it("forgets answers after a few minutes", async () => {
    const search = vi.fn(async () => ({ data: [], error: null }));
    await cachedPlannerSearch("plan_x", {}, search, T0);
    await cachedPlannerSearch("plan_x", {}, search, T0 + PLANNER_CACHE_TTL_MS - 1);
    await cachedPlannerSearch("plan_x", {}, search, T0 + PLANNER_CACHE_TTL_MS);
    expect(search).toHaveBeenCalledTimes(2);
  });

  it("never keeps an error or a thrown search, and passes the error on untouched", async () => {
    const error = Object.assign(new Error("canceling statement"), { code: "57014" });
    const failing = vi.fn(async () => ({ data: null, error }));
    expect((await cachedPlannerSearch("plan_x", {}, failing, T0)).error).toBe(error);
    await cachedPlannerSearch("plan_x", {}, failing, T0);
    expect(failing).toHaveBeenCalledTimes(2);
    const throwing = vi.fn(() => {
      throw new Error("offline");
    });
    await expect(cachedPlannerSearch("plan_z", {}, throwing, T0)).rejects.toThrow("offline");
    await expect(cachedPlannerSearch("plan_z", {}, throwing, T0)).rejects.toThrow("offline");
    expect(throwing).toHaveBeenCalledTimes(2);
  });

  it("gives each caller its own copy", async () => {
    const search = vi.fn(async () => ({ data: [{ legs: [{ minutes: 5 }] }], error: null }));
    const first = await cachedPlannerSearch("plan_x", {}, search, T0);
    first.data[0]!.legs[0]!.minutes = 99;
    const second = await cachedPlannerSearch("plan_x", {}, search, T0);
    expect(second.data[0]!.legs[0]!.minutes).toBe(5);
  });
});

import { describe, expect, it } from "vitest";
import { storeUrl } from "./sentry-server";

describe("storeUrl", () => {
  it("turns a Sentry DSN into its store address and auth header", () => {
    const { endpoint, auth } = storeUrl("https://abc123@o456.ingest.us.sentry.io/789");
    expect(endpoint).toBe("https://o456.ingest.us.sentry.io/api/789/store/");
    expect(auth).toContain("sentry_key=abc123");
  });
});

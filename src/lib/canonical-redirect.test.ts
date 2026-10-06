import { describe, expect, it } from "vitest";
import { canonicalRedirect, HSTS_HEADER, withHsts } from "./canonical-redirect";

const get = (url: string, method = "GET") => new Request(url, { method });

describe("one public address", () => {
  it("moves http:// to https://, keeping the path and query", () => {
    const response = canonicalRedirect(get("http://ridenalu.com/guides?ref=share"));
    expect(response?.status).toBe(301);
    expect(response?.headers.get("location")).toBe("https://ridenalu.com/guides?ref=share");
  });

  it("moves www and the old workers.dev address, as before", () => {
    expect(
      canonicalRedirect(get("https://www.ridenalu.com/roadwork"))?.headers.get("location"),
    ).toBe("https://ridenalu.com/roadwork");
    expect(canonicalRedirect(get("https://ridewithnalu.example.workers.dev/"))?.status).toBe(301);
  });

  it("leaves https://ridenalu.com, local development, jobs and form posts alone", () => {
    expect(canonicalRedirect(get("https://ridenalu.com/"))).toBeNull();
    expect(canonicalRedirect(get("http://127.0.0.1:5173/"))).toBeNull();
    expect(canonicalRedirect(get("http://ridenalu.com/api/cron/refresh"))).toBeNull();
    expect(canonicalRedirect(get("http://ridenalu.com/_serverFn/x", "POST"))).toBeNull();
  });
});

describe("HSTS", () => {
  it("is added to https://ridenalu.com responses only", () => {
    const secure = withHsts(get("https://ridenalu.com/"), new Response("ok"));
    expect(secure.headers.get("strict-transport-security")).toBe(HSTS_HEADER);
    const local = withHsts(get("http://127.0.0.1:5173/"), new Response("ok"));
    expect(local.headers.get("strict-transport-security")).toBeNull();
  });

  it("keeps the response's status and other headers", () => {
    const original = new Response("missing", {
      status: 404,
      headers: { "content-type": "text/html" },
    });
    const secured = withHsts(get("https://ridenalu.com/nope"), original);
    expect(secured.status).toBe(404);
    expect(secured.headers.get("content-type")).toBe("text/html");
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// .env is committed on purpose: it only holds public, browser-side values
// (Supabase URL and publishable key, Firebase web config, Mapbox public token,
// Sentry DSN, feature switches) that ship in the client bundle anyway.
// This test keeps it that way: a real secret added here would be committed
// and published, so CI fails instead. Failure messages name keys, never values.

const SERVER_PUBLIC = new Set(["SUPABASE_URL", "SUPABASE_PROJECT_ID", "SUPABASE_PUBLISHABLE_KEY"]);
const SECRET_NAME = /SECRET|SERVICE_ROLE|PRIVATE|PASSWORD/i;

function readEnv(): [string, string][] {
  const text = readFileSync(join(process.cwd(), ".env"), "utf8");
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const i = line.indexOf("=");
      return [
        line.slice(0, i).trim(),
        line
          .slice(i + 1)
          .trim()
          .replace(/^["']|["']$/g, ""),
      ];
    });
}

function jwtRole(value: string): string | null {
  const [, payloadPart, signature] = value.split(".");
  if (!payloadPart || !signature) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
    return typeof payload?.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

describe("committed .env holds only public values", () => {
  const entries = readEnv();

  it("only uses browser (VITE_) or known public names", () => {
    const unexpected = entries
      .map(([key]) => key)
      .filter((key) => !key.startsWith("VITE_") && !SERVER_PUBLIC.has(key));
    expect(unexpected).toEqual([]);
  });

  it("has no secret-looking names", () => {
    expect(entries.map(([key]) => key).filter((key) => SECRET_NAME.test(key))).toEqual([]);
  });

  it("has no secret-looking values", () => {
    const flagged = entries
      .filter(
        ([, value]) =>
          value.startsWith("sb_secret_") ||
          /^sk[-_]/.test(value) ||
          jwtRole(value) === "service_role",
      )
      .map(([key]) => key);
    expect(flagged).toEqual([]);
  });
});

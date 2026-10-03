import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  readServiceAccount,
  resetFcmTokenCache,
  sendFcmDirect,
  signServiceAccountJwt,
  type ServiceAccount,
} from "./fcm-direct.server";

let account: ServiceAccount;
let publicKey: CryptoKey;

function toPem(der: ArrayBuffer): string {
  const b64 = btoa(String.fromCharCode(...new Uint8Array(der)));
  return `-----BEGIN PRIVATE KEY-----\n${b64.match(/.{1,64}/g)!.join("\n")}\n-----END PRIVATE KEY-----\n`;
}

function decodeSegment(segment: string) {
  return JSON.parse(atob(segment.replace(/-/g, "+").replace(/_/g, "/")));
}

beforeAll(async () => {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  publicKey = pair.publicKey;
  account = {
    client_email: "push@nalu-test.iam.gserviceaccount.com",
    private_key: toPem(await crypto.subtle.exportKey("pkcs8", pair.privateKey)),
    project_id: "nalu-test",
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetFcmTokenCache();
});

describe("readServiceAccount", () => {
  it("is disabled when the secret is unset", () => {
    expect(readServiceAccount(undefined)).toBeNull();
    expect(readServiceAccount("")).toBeNull();
  });

  it("rejects a key missing required fields", () => {
    expect(() => readServiceAccount(JSON.stringify({ project_id: "x" }))).toThrow(/client_email/);
  });

  it("parses a downloaded service-account key", () => {
    expect(readServiceAccount(JSON.stringify(account))).toEqual(account);
  });
});

describe("signServiceAccountJwt", () => {
  it("signs an RS256 assertion Google can verify", async () => {
    const now = Date.UTC(2026, 9, 3, 12);
    const jwt = await signServiceAccountJwt(account, now);
    const [header, claims, signature] = jwt.split(".");

    expect(decodeSegment(header!)).toEqual({ alg: "RS256", typ: "JWT" });
    expect(decodeSegment(claims!)).toEqual({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now / 1000,
      exp: now / 1000 + 3600,
    });
    const sig = Uint8Array.from(atob(signature!.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
      c.charCodeAt(0),
    );
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      publicKey,
      sig,
      new TextEncoder().encode(`${header}.${claims}`),
    );
    expect(valid).toBe(true);
  });

  it("accepts a private key with escaped newlines from an env var", async () => {
    const escaped = { ...account, private_key: account.private_key.replace(/\n/g, "\\n") };
    await expect(signServiceAccountJwt(escaped, Date.now())).resolves.toMatch(
      /^[\w-]+\.[\w-]+\.[\w-]+$/,
    );
  });
});

describe("sendFcmDirect", () => {
  it("exchanges the assertion for a token, then sends to the project's FCM endpoint", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.startsWith("https://oauth2")
        ? Response.json({ access_token: "tok-1", expires_in: 3600 })
        : Response.json({ name: "projects/nalu-test/messages/1" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const payload = { message: { token: "device", notification: { title: "t", body: "b" } } };
    const response = await sendFcmDirect(account, payload, Date.now());

    expect(response.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [sendUrl, sendInit] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(sendUrl).toBe("https://fcm.googleapis.com/v1/projects/nalu-test/messages:send");
    expect((sendInit.headers as Record<string, string>)["Authorization"]).toBe("Bearer tok-1");
    expect(JSON.parse(sendInit.body as string)).toEqual(payload);
  });

  it("reuses the access token until it nears expiry", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.startsWith("https://oauth2")
        ? Response.json({ access_token: "tok", expires_in: 3600 })
        : Response.json({}),
    );
    vi.stubGlobal("fetch", fetchMock);
    const t0 = Date.now();

    await sendFcmDirect(account, {}, t0);
    await sendFcmDirect(account, {}, t0 + 30 * 60_000);
    expect(
      fetchMock.mock.calls.filter(([u]) => String(u).startsWith("https://oauth2")),
    ).toHaveLength(1);

    await sendFcmDirect(account, {}, t0 + 56 * 60_000);
    expect(
      fetchMock.mock.calls.filter(([u]) => String(u).startsWith("https://oauth2")),
    ).toHaveLength(2);
  });

  it("surfaces an auth failure instead of sending", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("invalid_grant", { status: 400 })),
    );
    await expect(sendFcmDirect(account, {}, Date.now())).rejects.toThrow(
      /Firebase auth failed \[400\]/,
    );
  });
});

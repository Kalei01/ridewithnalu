/**
 * Direct Firebase Cloud Messaging (HTTP v1) sender for self-hosted deploys.
 *
 * Enabled when FIREBASE_SERVICE_ACCOUNT_JSON holds a Firebase service-account
 * key; otherwise push.server.ts keeps using the hosted connector gateway.
 * Uses WebCrypto only, so it runs on both Node and Cloudflare Workers.
 */

export type ServiceAccount = { client_email: string; private_key: string; project_id: string };

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
/** Refresh this long before Google's one-hour expiry. */
const EXPIRY_MARGIN_MS = 5 * 60_000;

export function readServiceAccount(
  raw: string | undefined = process.env["FIREBASE_SERVICE_ACCOUNT_JSON"],
): ServiceAccount | null {
  if (!raw) return null;
  const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
  if (!parsed.client_email || !parsed.private_key || !parsed.project_id) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is missing client_email, private_key, or project_id.",
    );
  }
  return parsed as ServiceAccount;
}

function base64url(input: Uint8Array | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToDer(pem: string): Uint8Array<ArrayBuffer> {
  const body = pem
    .replace(/\\n/g, "\n")
    .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  return Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
}

export async function signServiceAccountJwt(sa: ServiceAccount, nowMs: number): Promise<string> {
  const iat = Math.floor(nowMs / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: FCM_SCOPE,
      aud: TOKEN_URL,
      iat,
      exp: iat + 3600,
    }),
  );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${header}.${claims}`),
  );
  return `${header}.${claims}.${base64url(new Uint8Array(signature))}`;
}

let cachedToken: { email: string; token: string; expiresAt: number } | null = null;

export function resetFcmTokenCache() {
  cachedToken = null;
}

async function accessToken(sa: ServiceAccount, nowMs: number): Promise<string> {
  if (cachedToken && cachedToken.email === sa.client_email && cachedToken.expiresAt > nowMs) {
    return cachedToken.token;
  }
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: await signServiceAccountJwt(sa, nowMs),
    }),
  });
  if (!response.ok) {
    throw new Error(`Firebase auth failed [${response.status}]: ${await response.text()}`);
  }
  const body = (await response.json()) as { access_token: string; expires_in?: number };
  cachedToken = {
    email: sa.client_email,
    token: body.access_token,
    expiresAt: nowMs + (body.expires_in ?? 3600) * 1000 - EXPIRY_MARGIN_MS,
  };
  return body.access_token;
}

/** Sends one FCM v1 request body ({ message: ... }) and returns FCM's response. */
export async function sendFcmDirect(
  sa: ServiceAccount,
  payload: unknown,
  nowMs: number = Date.now(),
): Promise<Response> {
  const token = await accessToken(sa, nowMs);
  return fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

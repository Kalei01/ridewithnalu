export const CANONICAL_ORIGIN = "https://ridenalu.com";
// ridenalu.com is confirmed live; the old address now forwards there.
const REDIRECT_OLD_ADDRESS = true;

/**
 * One public address. Pages on www.ridenalu.com, on plain http://, and (when
 * enabled) on the old workers.dev address move permanently to
 * https://ridenalu.com. Scheduled jobs under /api/ and the notification script
 * keep answering where they are.
 */
export function canonicalRedirect(request: Request): Response | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const url = new URL(request.url);
  const oldAddress = url.hostname.endsWith(".workers.dev") && REDIRECT_OLD_ADDRESS;
  const insecure = url.hostname === "ridenalu.com" && url.protocol === "http:";
  if (url.hostname !== "www.ridenalu.com" && !oldAddress && !insecure) return null;
  if (url.pathname.startsWith("/api/") || url.pathname === "/firebase-messaging-sw.js") return null;
  return Response.redirect(`${CANONICAL_ORIGIN}${url.pathname}${url.search}`, 301);
}

/**
 * Tells browsers to use https for ridenalu.com from now on. One month to
 * start, without subdomains or the browser preload list, so it is easy to
 * change; raise it once the site has run on https only for a while.
 */
export const HSTS_HEADER = "max-age=2592000";

export function withHsts(request: Request, response: Response): Response {
  const url = new URL(request.url);
  if (url.hostname !== "ridenalu.com" || url.protocol !== "https:") return response;
  if (response.headers.has("strict-transport-security")) return response;
  const secured = new Response(response.body, response);
  secured.headers.set("strict-transport-security", HSTS_HEADER);
  return secured;
}

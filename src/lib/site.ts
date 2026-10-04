/**
 * Public site origin used for canonical links, social cards, and structured
 * data. Set VITE_SITE_URL at build time when the app moves to a new domain
 * (and update public/sitemap.xml, public/robots.txt and public/llms.txt).
 */
export const SITE_URL: string =
  (import.meta.env["VITE_SITE_URL"] as string | undefined)?.replace(/\/$/, "") ||
  "https://ridewithnalu.jreverio01.workers.dev";

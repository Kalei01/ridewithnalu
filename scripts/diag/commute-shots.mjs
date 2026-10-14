// Commute (answer) screen shots + rows for three trips at 390×844. Run: node scripts/diag/commute-shots.mjs <prefix> [dark|rm]
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
const prefix = process.argv[2] ?? "after";
const rm = process.argv[3] === "rm";
const out = "docs/experience/commute-redesign";
const TRIPS = [
  ["kapolei-downtown", [21.335, -158.079], "21.3086,-157.8618", "Downtown Honolulu"],
  ["ewa-merchant", [21.3156, -158.0073], "21.3098,-157.8660", "Merchant St"],
  ["airport-waikiki", [21.3187, -157.9225], "21.2793,-157.8294", "Waikiki"],
];
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", proxy: { server: process.env.HTTPS_PROXY }, args: ["--ignore-certificate-errors-spki-list=PS48cX347wDVcRynzq+DFqswl2PLNE1sG6uQvxMCOS0="] });
for (const [key, [lat, lon], to, name] of TRIPS) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: rm ? "reduce" : "no-preference", geolocation: { latitude: lat, longitude: lon }, permissions: ["geolocation"] });
  await ctx.addInitScript(() => localStorage.setItem("nalu-welcome-seen-v1", "1"));
  const p = await ctx.newPage(); const errs = [];
  p.on("pageerror", (e) => { if (!String(e).includes("_leaflet_pos")) errs.push(String(e).slice(0, 160)); });
  await p.goto(`https://ridenalu.com/?to=${to}&name=${encodeURIComponent(name)}`, { waitUntil: "domcontentloaded" });
  await p.locator("section[aria-labelledby=trip-access-title]").waitFor({ timeout: 40000 }).catch(() => {});
  await p.getByRole("button", { name: /Include driving/i }).click().catch(() => {});
  const rows = p.locator("[role=radiogroup][aria-label='Ways to make this trip'] [role=radio]");
  const t0 = Date.now(); let txt = [];
  while (Date.now() - t0 < 60000) { txt = await rows.allInnerTexts().catch(() => []); if (txt.length && !txt.some((t) => /Checking/.test(t))) break; await p.waitForTimeout(2000); }
  await p.waitForTimeout(3000);
  await p.screenshot({ path: `${out}/${prefix}-${key}${rm ? "-rm" : ""}.png` });
  if (key === "kapolei-downtown") await p.screenshot({ path: `${out}/${prefix}-${key}${rm ? "-rm" : ""}-full.png`, fullPage: true });
  const sideways = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  console.log(key, "rows:", txt.map((t) => t.replace(/\s+/g, " ").slice(0, 70)).join(" || "), "| sideways:", sideways, "| errors:", errs.length);
  await ctx.close();
}
await b.close();

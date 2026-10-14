// Browse screen screenshots at 390×844 (dark, light-scheme, reduced motion) + error check.
// Run: node scripts/diag/browse-shots.mjs <url> <out-dir> <prefix> [lat lon]
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { mkdirSync } from "node:fs";
const [url = "https://ridenalu.com/", out = "docs/experience/browse-redesign", prefix = "after", lat = "21.3385", lon = "-158.0306"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const live = url.startsWith("https://");
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  ...(live ? { proxy: { server: process.env.HTTPS_PROXY }, args: ["--ignore-certificate-errors-spki-list=PS48cX347wDVcRynzq+DFqswl2PLNE1sG6uQvxMCOS0="] } : {}),
});
for (const [name, options] of [["dark", { colorScheme: "dark" }], ["light", { colorScheme: "light" }], ["reduced-motion", { colorScheme: "dark", reducedMotion: "reduce" }]]) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, geolocation: { latitude: +lat, longitude: +lon }, permissions: ["geolocation"], ...options });
  await context.addInitScript(() => { try { localStorage.setItem("nalu-welcome-seen-v1", "1"); } catch {} });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 }).catch(() => {});
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${out}/${prefix}-${name}-first-screen.png` });
  await page.screenshot({ path: `${out}/${prefix}-${name}-full.png`, fullPage: true });
  const sideways = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  const text = await page.evaluate(() => document.body.innerText);
  console.log(name, "sideways:", sideways, "errors:", errors.length, errors.join("|"), "| skyline station:", /Skyline station/i.test(text), "| nearby:", /Nearby stops/i.test(text), "| departures:", /Eastbound|Westbound/.test(text));
  await context.close();
}
await browser.close();

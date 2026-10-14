// Screenshots of the home page at iPhone size (390×844): light, dark and reduced motion,
// first screen and full page, plus the race finished. Also reports sideways scroll and console errors.
// Run: node scripts/diag/home-shots.mjs <url> <out-dir> [--race]
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { mkdirSync } from "node:fs";

const [url = "http://127.0.0.1:5173/home-preview", out = "docs/experience/home-redesign"] =
  process.argv.slice(2);
const race = process.argv.includes("--race");
mkdirSync(out, { recursive: true });
const live = url.startsWith("https://");
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  ...(live
    ? {
        proxy: { server: process.env.HTTPS_PROXY },
        args: [
          "--ignore-certificate-errors-spki-list=PS48cX347wDVcRynzq+DFqswl2PLNE1sG6uQvxMCOS0=",
        ],
      }
    : {}),
});
for (const [name, options] of [
  ["light", { colorScheme: "light" }],
  ["dark", { colorScheme: "dark" }],
  ["reduced-motion", { colorScheme: "dark", reducedMotion: "reduce" }],
]) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    ...options,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 160)));
  await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/${name}-first-screen.png` });
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(3500);
  if (race) {
    const button = page.getByRole("button", { name: /Race it/ });
    await button.waitFor({ timeout: 40_000 }).catch(() => {});
    await page
      .waitForFunction(
        () => !document.querySelector("button[disabled]")?.textContent?.includes("Race it"),
        null,
        { timeout: 40_000 },
      )
      .catch(() => {});
    await button.click().catch(() => {});
    await page.waitForTimeout(options.reducedMotion ? 1500 : 4500);
    await page.screenshot({ path: `${out}/${name}-race-midway.png` });
    await page.waitForTimeout(options.reducedMotion ? 500 : 6000);
    await page.locator("#live-island").scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -10));
    await page.screenshot({ path: `${out}/${name}-race.png` });
  }
  await page.screenshot({ path: `${out}/${name}-full.png`, fullPage: true });
  const sideways = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  console.log(
    `${name}: page height ${height}px (${(height / 844).toFixed(1)} screens), sideways scroll ${sideways}px, errors ${errors.length}`,
  );
  errors.forEach((e) => console.log("   ", e));
  await context.close();
}
await browser.close();

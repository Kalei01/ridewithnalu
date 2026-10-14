// Commute screen at iPhone 15 Pro size (393×852, 59px top inset), CPU 4x throttle: header position, long tasks and frame times while idle and scrolling.
// Run: node scripts/diag/commute-smooth.mjs [--wait-for-fix]
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
const wait = process.argv.includes("--wait-for-fix");
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", proxy: { server: process.env.HTTPS_PROXY }, args: ["--ignore-certificate-errors-spki-list=PS48cX347wDVcRynzq+DFqswl2PLNE1sG6uQvxMCOS0="] });
for (let attempt = 0; attempt < (wait ? 30 : 1); attempt++) {
  const c = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: "dark", geolocation: { latitude: 21.335, longitude: -158.079 }, permissions: ["geolocation"] });
  await c.addInitScript(() => localStorage.setItem("nalu-welcome-seen-v1", "1"));
  const p = await c.newPage(); const cdp = await c.newCDPSession(p);
  await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 59, left: 0, right: 0, bottom: 34 } });
  await p.goto("https://ridenalu.com/?to=21.3086,-157.8618&name=Downtown%20Honolulu", { waitUntil: "domcontentloaded" });
  await p.locator("section[aria-labelledby=trip-access-title]").waitFor({ timeout: 40000 }).catch(() => {});
  await p.getByRole("button", { name: /Include driving/i }).click().catch(() => {});
  await p.waitForTimeout(12000);
  const info = await p.evaluate(() => { const w = document.querySelector(".nh-waves"); return { headerTop: Math.round(document.querySelector("main header")?.getBoundingClientRect().top ?? -1), wavesPos: w ? getComputedStyle(w).position : "none" }; });
  if (wait && info.wavesPos !== "absolute") { await c.close(); await new Promise((r) => setTimeout(r, 20000)); continue; }
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await p.evaluate(() => { window.__lt = []; window.__fr = []; new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push(Math.round(e.duration)))).observe({ entryTypes: ["longtask"] }); let last = performance.now(); const f = (t) => { window.__fr.push(t - last); last = t; requestAnimationFrame(f); }; requestAnimationFrame(f); });
  await p.waitForTimeout(4000);
  for (let i = 0; i < 12; i++) { await p.mouse.wheel(0, 350); await p.waitForTimeout(250); }
  const m = await p.evaluate(() => { const fr = window.__fr.slice(5).sort((a, b) => a - b); return { longTasks: window.__lt, frames: fr.length, p50: Math.round(fr[Math.floor(fr.length / 2)]), p95: Math.round(fr[Math.floor(fr.length * 0.95)]), over50: fr.filter((x) => x > 50).length }; });
  console.log(JSON.stringify({ ...info, ...m }));
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(500);
  await p.screenshot({ path: "docs/experience/commute-redesign/fixed-inset59-dark.png" });
  await c.close(); break;
}
await b.close();

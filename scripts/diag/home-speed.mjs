// Home page speed at iPhone size: LCP, CLS and script weight, median of N cold loads.
// Run: node scripts/diag/home-speed.mjs [url] [runs]
//   e.g. node scripts/diag/home-speed.mjs https://ridenalu.com/ 5
//        node scripts/diag/home-speed.mjs https://ridenalu.com/home-preview 5
// Network is throttled to a "fast 4G" phone (≈9 Mbps down, 150 ms RTT, 4× CPU slowdown).
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";

const url = process.argv[2] ?? "https://ridenalu.com/";
const runs = Number(process.argv[3] ?? 5);
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

const results = [];
for (let run = 0; run < runs; run += 1) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (9 * 1024 * 1024) / 8,
    uploadThroughput: (2 * 1024 * 1024) / 8,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  let scriptBytes = 0;
  const scripts = new Map();
  cdp.on("Network.responseReceived", (event) => {
    if (event.type === "Script") scripts.set(event.requestId, 0);
  });
  cdp.on("Network.loadingFinished", (event) => {
    if (scripts.has(event.requestId)) scripts.set(event.requestId, event.encodedDataLength);
  });
  await page.addInitScript(() => {
    window.__cls = 0;
    window.__lcp = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__cls += entry.value;
    }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      window.__lcp = entries[entries.length - 1].startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });
  await page.goto(url, { waitUntil: "load", timeout: 90_000 });
  await page.waitForTimeout(4000);
  // Scroll once so below-the-fold lazy parts load and their shifts count.
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(2500);
  const metrics = await page.evaluate(() => ({ lcp: window.__lcp, cls: window.__cls }));
  for (const bytes of scripts.values()) scriptBytes += bytes;
  results.push({ ...metrics, scriptKB: scriptBytes / 1024 });
  await context.close();
}
await browser.close();

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
console.log(url);
for (const r of results)
  console.log(
    `  LCP ${Math.round(r.lcp)} ms · CLS ${r.cls.toFixed(3)} · scripts ${r.scriptKB.toFixed(0)} KB (transferred)`,
  );
console.log(
  `  median: LCP ${Math.round(median(results.map((r) => r.lcp)))} ms · CLS ${median(results.map((r) => r.cls)).toFixed(3)} · scripts ${median(results.map((r) => r.scriptKB)).toFixed(0)} KB`,
);

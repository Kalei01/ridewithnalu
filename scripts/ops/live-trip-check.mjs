// Live check: Kapolei -> downtown on ridenalu.com (phone profile), prints rows-ready time and rows. Usage: node scripts/ops/live-trip-check.mjs
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', proxy: { server: process.env.HTTPS_PROXY }, args: ['--ignore-certificate-errors-spki-list=PS48cX347wDVcRynzq+DFqswl2PLNE1sG6uQvxMCOS0='] });
const ctx = await b.newContext({ ...devices['iPhone SE'], geolocation: { latitude: 21.3350, longitude: -158.0790 }, permissions: ['geolocation'] });
await ctx.addInitScript(() => localStorage.setItem('nalu-welcome-seen-v1', '1'));
const p = await ctx.newPage(); const errs = [];
p.on('pageerror', e => { if (!String(e).includes('_leaflet_pos')) errs.push(String(e).slice(0,200)); });
await p.goto('https://ridenalu.com/?to=21.3086,-157.8618&name=Downtown%20Honolulu', { waitUntil: 'domcontentloaded' });
const q = p.locator('section[aria-labelledby=trip-access-title]');
await q.waitFor({ timeout: 30000 }).catch(() => {});
await p.getByRole('button', { name: /Include driving/i }).click().catch(e => console.log('no question', e.message.slice(0,80)));
const rows = p.locator("[role=radiogroup][aria-label='Ways to make this trip'] [role=radio]");
const t0 = Date.now(); let txt = [];
while (Date.now() - t0 < 60000) { txt = await rows.allInnerTexts(); if (txt.length && !txt.some(t => /Checking/.test(t))) break; await p.waitForTimeout(2000); }
console.log(((Date.now()-t0)/1000).toFixed(1)+'s'); txt.forEach(t => console.log('ROW:', t.replace(/\s+/g,' ').slice(0,140)));
console.log('errors:', errs);
await b.close();

// Phase 2 live side-by-side on ridenalu.com (read-only): each trip loaded at iPhone size through the
// old path (phone runs the searches) and the new one (one server request), back to back, comparing
// the rows riders see and rows-ready time. Run: node scripts/phase2/live-side-by-side.mjs [rounds]
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const ROUNDS = Number(process.argv[2] ?? 1);
const TRIPS = [
  { name: 'Kapolei → downtown', geo: { latitude: 21.335, longitude: -158.079 }, to: '21.3086,-157.8618&name=Downtown%20Honolulu', drive: true },
  { name: 'ʻEwa Beach → Merchant St', geo: { latitude: 21.319, longitude: -158.032 }, to: '21.30937,-157.86318&name=Merchant', drive: true },
  { name: 'Airport → Waikīkī', geo: { latitude: 21.3245, longitude: -157.9251 }, to: '21.2793,-157.8294&name=Waikiki', drive: false },
];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', proxy: { server: process.env.HTTPS_PROXY }, args: ['--ignore-certificate-errors-spki-list=PS48cX347wDVcRynzq+DFqswl2PLNE1sG6uQvxMCOS0='] });
async function run(trip, path) {
  const ctx = await b.newContext({ ...devices['iPhone SE'], geolocation: trip.geo, permissions: ['geolocation'] });
  await ctx.addInitScript((p) => { localStorage.setItem('nalu-welcome-seen-v1', '1'); sessionStorage.setItem('nalu-plan-path', p); }, path);
  const p = await ctx.newPage(); const t0 = Date.now(); let rpcCalls = 0; let planServer = null; const errs = [];
  p.on('request', (r) => { if (/\/rest\/v1\/rpc\/(plan_|service_hours|rail_stations|diagnose)/.test(r.url())) rpcCalls += 1; });
  p.on('response', async (r) => {
    const req = r.request(); if (!req.url().includes('_serverFn') || !(req.postData() || '').includes('browseStations')) return;
    const started = Date.now();
    try { const t = await r.text(); planServer = { status: r.status(), at: ((Date.now() - t0) / 1000).toFixed(1), ms: (t.match(/"ms"[^0-9]*(\d+)/) || [])[1], overBudget: /overBudget[^a-z]*true/.test(t), failed: /"failed"[^a-z]*true/.test(t) }; } catch { planServer = { status: r.status() }; }
  });
  p.on('pageerror', (e) => { if (!String(e).includes('_leaflet_pos')) errs.push(String(e).slice(0, 120)); });
  await p.goto(`https://ridenalu.com/?to=${trip.to}`, { waitUntil: 'domcontentloaded' });
  await p.locator('section[aria-labelledby=trip-access-title]').waitFor({ timeout: 30000 }).catch(() => {});
  await p.getByRole('button', { name: trip.drive ? /Include driving/i : /No driving/i }).first().click().catch(() => {});
  const clicked = Date.now();
  const rows = p.locator("[role=radiogroup][aria-label='Ways to make this trip'] [role=radio]");
  let txt = [];
  while (Date.now() - t0 < 90000) { txt = await rows.allInnerTexts(); if (txt.length && !txt.some((t) => /Checking/.test(t))) break; await p.waitForTimeout(250); }
  const ready = ((Date.now() - clicked) / 1000).toFixed(1);
  await ctx.close();
  return { ready, rows: txt.map((t) => t.replace(/\s+/g, ' ').slice(0, 90)), rpcCalls, planServer, errs };
}
const hst = () => new Date().toLocaleTimeString('en-US', { timeZone: 'Pacific/Honolulu' });
for (let round = 1; round <= ROUNDS; round += 1) for (const trip of TRIPS) {
  const phone = await run(trip, 'phone');
  const server = await run(trip, 'server');
  const transit = (r) => r.rows.filter((x) => !/^Drive/.test(x)).join(' || ');
  console.log(`=== ${trip.name} @ ${hst()} HST | round ${round} | transit rows ${transit(phone) === transit(server) ? 'SAME' : 'DIFFERENT'}`);
  console.log(`  phone : rows ready ${phone.ready}s after the question, ${phone.rpcCalls} planner calls from the phone, errors ${phone.errs.length}`);
  console.log(`  server: rows ready ${server.ready}s, ${server.rpcCalls} planner calls from the phone, server call ${JSON.stringify(server.planServer)}, errors ${server.errs.length}`);
  phone.rows.forEach((r) => console.log('  P:', r));
  server.rows.forEach((r) => console.log('  S:', r));
}
await b.close();

// Read-only diagnostic: records the planner's database and drive-time calls during a live
// Kapolei -> downtown trip, twice 60 s apart, plus how the Skyline row changes. Run: node scripts/diag/rush-hour-trip-recorder.mjs
// Records every planner database call and live drive-time call during a Kapolei -> downtown trip.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', proxy: { server: process.env.HTTPS_PROXY }, args: ['--ignore-certificate-errors-spki-list=PS48cX347wDVcRynzq+DFqswl2PLNE1sG6uQvxMCOS0='] });
async function attempt(label) {
  const ctx = await b.newContext({ ...devices['iPhone SE'], geolocation: { latitude: 21.3350, longitude: -158.0790 }, permissions: ['geolocation'] });
  await ctx.addInitScript(() => localStorage.setItem('nalu-welcome-seen-v1', '1'));
  const p = await ctx.newPage(); const t0 = Date.now(); const calls = []; const errs = [];
  const started = new Map();
  p.on('request', r => { if (/\/rest\/v1\/rpc\/|_serverFn/.test(r.url())) started.set(r, Date.now()); });
  p.on('requestfailed', r => { if (started.has(r)) calls.push({ at: ((started.get(r)-t0)/1000).toFixed(1), fn: r.url().split('/').pop().slice(0,60), FAILED: r.failure()?.errorText }); });
  p.on('response', async r => {
    const req = r.request(); if (!started.has(req)) return;
    const u = req.url(); const fn = u.includes('/rpc/') ? u.split('/rpc/')[1].split('?')[0] : 'serverFn:' + (u.split('_serverFn/')[1] || '').slice(0, 40);
    let rows = null, err = null, extra = null;
    try { const j = await r.json(); if (Array.isArray(j)) rows = j.length; else if (j && (j.code || j.message)) err = `${j.code||''} ${String(j.message||'').slice(0,80)}`; else extra = JSON.stringify(j).slice(0, 120); } catch { }
    let args = null; try { const a = JSON.parse(req.postData() || '{}'); args = { station: a.p_station, after: a.p_after_seconds, drive: a.p_allow_drive, stations: a.p_stations }; } catch {}
    calls.push({ at: ((started.get(req)-t0)/1000).toFixed(1), ms: Date.now()-started.get(req), fn, status: r.status(), rows, err, args: fn.startsWith('plan') ? args : undefined, extra: fn.startsWith('serverFn') ? extra : undefined });
  });
  p.on('pageerror', e => { if (!String(e).includes('_leaflet_pos')) errs.push(String(e).slice(0,150)); });
  await p.goto('https://ridenalu.com/?to=21.3086,-157.8618&name=Downtown%20Honolulu', { waitUntil: 'domcontentloaded' });
  await p.locator('section[aria-labelledby=trip-access-title]').waitFor({ timeout: 30000 }).catch(() => {});
  const clickAt = ((Date.now()-t0)/1000).toFixed(1);
  await p.getByRole('button', { name: /Include driving/i }).click().catch(() => console.log('no question'));
  const rows = p.locator("[role=radiogroup][aria-label='Ways to make this trip'] [role=radio]");
  let txt = []; let lastSky = ''; const skyLog = [];
  while (Date.now() - t0 < 70000) {
    txt = await rows.allInnerTexts();
    const sky = (txt.find(x => x.startsWith('Skyline')) ?? '(no Skyline row)').replace(/\s+/g,' ').slice(0,60);
    if (sky !== lastSky) { skyLog.push(((Date.now()-t0)/1000).toFixed(1)+'s '+sky); lastSky = sky; }
    if (txt.length && !txt.some(t => /Checking/.test(t))) break;
    await p.waitForTimeout(500);
  }
  const doneAt = ((Date.now()-t0)/1000).toFixed(1);
  await p.waitForTimeout(3000);
  console.log(`=== ${label} @ ${new Date().toLocaleTimeString('en-US',{timeZone:'Pacific/Honolulu'})} HST | question clicked ${clickAt}s | rows ready ${doneAt}s`);
  txt.forEach(t => console.log('ROW:', t.replace(/\s+/g,' ').slice(0,110)));
  skyLog.forEach(l => console.log('SKYLINE ROW:', l));
  calls.sort((a,b)=>a.at-b.at).forEach(c => console.log(JSON.stringify(c)));
  console.log('errors:', errs);
  await ctx.close();
}
await attempt('attempt 1');
await new Promise(r => setTimeout(r, 60000));
await attempt('attempt 2');
await b.close();

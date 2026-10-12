// Read-only diagnostic: Drive row for Josh's Home (ʻEwa Beach, ~3-decimal point) -> 55 Merchant St at 390x844, prints TomTom live/typical minutes + meters per drive call. Run: node scripts/diag/drive-eta-check.mjs
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const HOME={latitude:21.319,longitude:-158.032}; // Josh's Home (ʻEwa Beach), rounded
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', proxy: { server: process.env.HTTPS_PROXY } });
const ctx = await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true, geolocation: HOME, permissions: ['geolocation'] });
await ctx.addInitScript(() => localStorage.setItem('nalu-welcome-seen-v1', '1'));
const p = await ctx.newPage();
const pick=(t,k)=>{const m=t.match(new RegExp('"'+k+'"[^]*?'));return m};
p.on('response', async r => { if (!r.url().includes('_serverFn')) return; const req=r.request().postData()||''; if(!req.includes('fromLat')||req.includes('browse')) return; const t=await r.text();
  const keys=(t.match(/"k":\[("trafficMinutes[^\]]*)\]/)||[])[1]; if(!keys) return;
  const vals=[...t.matchAll(/\{"t":0,"s":(-?[\d.]+)\}/g)].map(m=>m[1]).slice(0,8);
  const reqv=[...req.matchAll(/\{"t":0,"s":(-?[\d.]+)\}/g)].map(m=>m[1]);
  console.log('DRIVE req nums(fromLat,fromLon,toLat,toLon,..bearing?):',reqv.join(','),'| keys in req:',(req.match(/"k":\[([^\]]*)\]/g)||[]).join(' ').slice(0,200));
  console.log('  resp traffic,typical,delay,low,high,meters:',vals.join(','));
  console.log('  corridor:',(t.match(/"corridorLabel"[^]*?\{"t":1,"s":"([^"]*)"/)||[])[1], '| incidents arr / basis:', (t.match(/"trafficBasis"|"live"/g)||[]).length);
  console.log('  corridor strings:',[...t.matchAll(/"s":"((?:H-|Fort|Farrington|Kapolei|Kamehameha|Ewa|Moanalua|Nimitz)[^"]{0,60})"/g)].map(m=>m[1]).slice(0,10).join(' | '));
});
await p.goto('https://ridenalu.com/?to=21.30937,-157.86318&name=Merchant', { waitUntil: 'domcontentloaded' });
await p.locator('section[aria-labelledby=trip-access-title]').waitFor({ timeout: 30000 }).catch(() => {});
await p.getByRole('button', { name: /Include driving/i }).click().catch(()=>console.log('no question'));
const rows = p.locator("[role=radiogroup][aria-label='Ways to make this trip'] [role=radio]");
const t0=Date.now(); let txt=[];
while (Date.now()-t0<60000){ txt=await rows.allInnerTexts(); if(txt.length&&!txt.some(t=>/Checking/.test(t)))break; await p.waitForTimeout(1500);}
console.log('HST', new Date().toLocaleTimeString('en-US',{timeZone:'Pacific/Honolulu'}));
txt.forEach(t=>console.log('ROW:',t.replace(/\s+/g,' ').slice(0,160)));
const drive=rows.filter({hasText:/^Drive/}); if(await drive.count()) await drive.first().click().catch(()=>{});
await p.waitForTimeout(2000);
await p.screenshot({path:'/tmp/drive-eta.png'});
console.log((await p.locator('body').innerText()).match(/[^\n]*(Drive|delay|typical|km|mi\b)[^\n]*/gi)?.slice(0,25).join('\n'));
await b.close();

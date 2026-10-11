// Read-only SQL against production via the Supabase Management API (needs SUPABASE_ACCESS_TOKEN in the environment; never print it). Usage: node scripts/ops/db-read.mjs "select ..."
const query = process.argv[2];
const res = await fetch('https://api.supabase.com/v1/projects/nsoameosqsnumjivkmyv/database/query/read-only', {
  method: 'POST', headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }) });
const t = await res.text(); console.log('HTTP', res.status); 
try { const j = JSON.parse(t); console.log(JSON.stringify(j,null,0).slice(0,4000)); } catch { console.log(t.slice(0, 3000)); }

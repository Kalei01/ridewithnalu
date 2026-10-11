// WRITE SQL file to production (Management API). Only under the standing database authorization in .claude/agents/nalu-lead.md: reviewed, rollback written, off-peak, logged. Usage: node scripts/ops/db-write.mjs path/to/file.sql
import { readFileSync } from 'node:fs';
const file = process.argv[2];
const query = readFileSync(file, 'utf8');
const res = await fetch('https://api.supabase.com/v1/projects/nsoameosqsnumjivkmyv/database/query', {
  method: 'POST',
  headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
});
const text = await res.text();
console.log('HTTP', res.status, text.slice(0, 600));
if (!res.ok) process.exit(1);

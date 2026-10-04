// Weekly TheBus timetable refresh, run by .github/workflows/gtfs-refresh.yml.
// Calls the app's own import route in-process (Cloudflare's per-request limits
// are too tight for the full feed) and keeps resuming until it finishes.
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const admin = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !admin) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");

// The route checks a cron secret; this process is the only caller.
const cronSecret = randomBytes(32).toString("hex");
process.env.CRON_SECRET = cronSecret;

const { Route } = await import("../src/routes/api/public/import-gtfs.ts");
const post = (Route as unknown as {
  options: { server: { handlers: { POST: (ctx: { request: Request }) => Promise<Response> } } };
}).options.server.handlers.POST;
const db = createClient(url, admin, { auth: { persistSession: false } });

let finished = false;
for (let call = 1; call <= 30; call += 1) {
  if (call > 1) {
    // Only this process runs the import, so the previous chunk isn't "still
    // running": age its heartbeat past the route's 10-minute guard and resume.
    await db
      .from("job_status")
      .update({ last_updated_at: new Date(Date.now() - 11 * 60_000).toISOString() })
      .eq("status", "running");
  }
  const request = new Request("http://local/api/public/import-gtfs", {
    method: "POST",
    headers: { Authorization: `Bearer ${cronSecret}`, "Content-Type": "application/json" },
    body: JSON.stringify(call === 1 ? {} : { mode: "resume" }),
  });
  const response = await post({ request });
  const text = await response.text();
  console.log(`call ${call}: HTTP ${response.status} ${text.slice(0, 300)}`);
  const body = JSON.parse(text || "{}") as { success?: boolean; partial?: boolean; skipped?: boolean };
  if (response.status >= 400 || body.success === false) break;
  if (body.skipped || (body.success && !body.partial)) {
    finished = true;
    break;
  }
}

const { data: expiry } = await db.rpc("gtfs_data_expiry");
console.log("timetable now valid until:", JSON.stringify(expiry));
if (!finished) {
  console.error("Timetable refresh did not finish.");
  process.exit(1);
}

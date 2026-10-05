import { createFileRoute } from "@tanstack/react-router";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function page(title: string, body: string, form = ""): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title} · Nalu</title>
<style>body{margin:0;background:#07141b;color:#f5f7fa;font:17px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:grid;place-items:center;min-height:100vh;padding:16px;box-sizing:border-box}main{max-width:420px;text-align:center}img{border-radius:14px}h1{font-size:24px;margin:16px 0 8px}p{color:#aeb8c2;margin:0 0 20px}button{font:inherit;font-weight:600;background:#287fc0;color:#fff;border:0;border-radius:12px;padding:14px 32px;min-height:48px;cursor:pointer}a{color:#69b7f5}</style></head>
<body><main><img src="/icons/icon-192.png" width="64" height="64" alt="Nalu"><h1>${title}</h1><p>${body}</p>${form}<p style="margin-top:24px"><a href="/">Open Nalu</a></p></main></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

async function unsubscribe(token: string | null): Promise<boolean> {
  if (!token || !UUID.test(token)) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const rpc = supabaseAdmin.rpc.bind(supabaseAdmin) as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown }>;
  const { data } = await rpc("email_unsubscribe", { p_token: token });
  return data === true;
}

/**
 * Unsubscribe link in every Nalu email. Opening the link only shows a button,
 * because mail scanners open links on their own; the button (or Gmail's
 * one-click unsubscribe) sends the POST that actually unsubscribes.
 */
export const Route = createFileRoute("/api/public/unsubscribe")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("t") ?? "";
        if (!UUID.test(token)) return page("Link not recognized", "This unsubscribe link looks incomplete. You can also turn emails off in Nalu under Settings, Notifications.");
        return page(
          "Stop Nalu emails?",
          "You'll stop getting commute emails. Sign-in emails still arrive when you ask for one.",
          `<form method="post"><input type="hidden" name="t" value="${token}"><button type="submit">Unsubscribe</button></form>`,
        );
      },
      POST: async ({ request }) => {
        const form = await request.formData().catch(() => null);
        const fromForm = form?.get("t");
        const token = new URL(request.url).searchParams.get("t") ?? (typeof fromForm === "string" ? fromForm : null);
        const done = await unsubscribe(token);
        // Gmail and Apple Mail's one-tap unsubscribe only need a status code.
        if (form?.get("List-Unsubscribe") === "One-Click") {
          return new Response(done ? "Unsubscribed" : "Not found", { status: done ? 200 : 404 });
        }
        return done
          ? page("You're unsubscribed", "Nalu won't send you commute emails anymore. You can turn them back on in Settings, Notifications.")
          : page("Link not recognized", "We couldn't find that subscription. It may already be off.");
      },
    },
  },
});

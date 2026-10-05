import { FROM, type RenderedEmail } from "./layout";

export type SendResult = { ok: true; id: string } | { ok: false; error: string };

/** Send one email through Resend. Never throws; the key lives in Cloudflare Secrets. */
export async function sendEmail(to: string, email: RenderedEmail, unsubUrl: string): Promise<SendResult> {
  const key = process.env["RESEND_API_KEY"];
  if (!key) return { ok: false, error: "RESEND_API_KEY is not set" };
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject: email.subject,
        html: email.html,
        text: email.text,
        // One-tap unsubscribe in Gmail and Apple Mail.
        headers: {
          "List-Unsubscribe": `<${unsubUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
    });
    const body = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!response.ok || !body.id) return { ok: false, error: body.message ?? `Resend HTTP ${response.status}` };
    return { ok: true, id: body.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Resend request failed" };
  }
}

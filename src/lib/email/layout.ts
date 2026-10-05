/**
 * Nalu's email look, matching the sign-in emails in supabase/email-templates.
 * Pure functions so they can be tested without sending anything.
 */
export const SITE = "https://ridenalu.com";
export const LOGO_URL = `${SITE}/icons/icon-192.png`;
export const FROM = "Nalu <noreply@ridenalu.com>";

/**
 * US email law (CAN-SPAM) needs a postal address in marketing emails.
 * Empty until the owner picks one (a PO box works); see needsAddress().
 */
export const MAILING_ADDRESS = "";

export type EmailContent = {
  subject: string;
  heading: string;
  intro: string;
  steps?: string[];
  button: { label: string; url: string };
  link?: { label: string; url: string };
};

export type RenderedEmail = { subject: string; html: string; text: string };

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function unsubscribeUrl(token: string): string {
  return `${SITE}/api/public/unsubscribe?t=${encodeURIComponent(token)}`;
}

export function renderEmail(content: EmailContent, unsubUrl: string): RenderedEmail {
  const e = escapeHtml;
  const steps = content.steps?.length
    ? `<tr><td style="padding:16px 32px 0;"><ol style="margin:0;padding-left:22px;font-size:17px;line-height:1.5;color:#3a434c;">${content.steps
        .map((s) => `<li style="margin:0 0 10px;">${e(s)}</li>`)
        .join("")}</ol></td></tr>`
    : "";
  const link = content.link
    ? `<tr><td align="center" style="padding:4px 32px 0;"><a href="${e(content.link.url)}" style="font-size:15px;color:#287fc0;">${e(content.link.label)}</a></td></tr>`
    : "";
  const address = MAILING_ADDRESS ? `<br>${e(MAILING_ADDRESS)}` : "";
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${e(content.subject)}</title></head>
<body style="margin:0;padding:0;background:#eef2f5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f5;padding:32px 16px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;font-family:${FONT};color:#08090b;">
<tr><td align="center" style="padding:36px 32px 8px;"><img src="${LOGO_URL}" width="64" height="64" alt="Nalu" style="display:block;border:0;border-radius:14px;"></td></tr>
<tr><td align="center" style="padding:16px 32px 0;"><h1 style="margin:0;font-size:24px;line-height:1.3;font-weight:700;">${e(content.heading)}</h1></td></tr>
<tr><td style="padding:12px 32px 0;"><p style="margin:0;font-size:17px;line-height:1.5;color:#3a434c;">${e(content.intro)}</p></td></tr>
${steps}
<tr><td align="center" style="padding:24px 32px 8px;"><a href="${e(content.button.url)}" style="display:inline-block;background:#287fc0;color:#ffffff;text-decoration:none;font-size:18px;font-weight:600;padding:16px 36px;border-radius:12px;">${e(content.button.label)}</a></td></tr>
${link}
<tr><td style="padding:24px 32px 32px;"></td></tr>
</table>
<p style="margin:20px 0 0;font-family:${FONT};font-size:13px;line-height:1.6;color:#59636d;">You're getting this because you turned on Nalu emails. <a href="${e(unsubUrl)}" style="color:#287fc0;">Unsubscribe</a><br>Nalu &middot; Your Oʻahu commute, decided &middot; <a href="${SITE}" style="color:#287fc0;">ridenalu.com</a>${address}</p>
</td></tr></table>
</body></html>
`;
  const text = [
    content.heading,
    "",
    content.intro,
    ...(content.steps?.length ? ["", ...content.steps.map((s, i) => `${i + 1}. ${s}`)] : []),
    "",
    `${content.button.label}: ${content.button.url}`,
    ...(content.link ? [`${content.link.label}: ${content.link.url}`] : []),
    "",
    "You're getting this because you turned on Nalu emails.",
    `Unsubscribe: ${unsubUrl}`,
    ...(MAILING_ADDRESS ? [MAILING_ADDRESS] : []),
  ].join("\n");
  return { subject: content.subject, html, text };
}

/** Sent once, right after a rider turns on emails. */
export function welcomeEmail(): EmailContent {
  return {
    subject: "You're in: 3 quick steps to get the most from Nalu",
    heading: "You're in",
    intro: "Nalu tells you the fastest way across Oʻahu, right now. Three quick steps make it work best:",
    steps: [
      "Add Nalu to your Home Screen, so leave alerts can reach your phone.",
      "Save home and work, so your answer is one tap away.",
      "Turn on a leave alert, and Nalu tells you when to go.",
    ],
    button: { label: "Open Nalu", url: `${SITE}/?ref=email_welcome` },
    link: { label: "How to add Nalu to your Home Screen", url: `${SITE}/install?ref=email_welcome` },
  };
}

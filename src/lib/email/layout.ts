/**
 * Nalu's email look, matching the sign-in emails in supabase/email-templates.
 * Pure functions so they can be tested without sending anything.
 * Voice and wording rules live in docs/email-voice.md.
 */
export const SITE = "https://ridenalu.com";
export const LOGO_URL = `${SITE}/icons/icon-192.png`;
export const FROM = "Nalu <noreply@ridenalu.com>";

/**
 * US email law (CAN-SPAM) needs a postal address in marketing emails.
 * Empty until the owner picks one (a PO box works); see needsAddress().
 */
export const MAILING_ADDRESS = "";

/** One row in a list: a bold title, an optional line under it, and an optional "when" line. */
export type EmailItem = { title: string; body?: string; meta?: string };

/** A soft blue panel holding numbered steps or a plain list. */
export type EmailList = {
  title?: string;
  numbered?: boolean;
  items: EmailItem[];
  /** Small line under the list, e.g. "Plus 3 more in Nalu." */
  note?: string;
};

export type EmailContent = {
  subject: string;
  /** Hidden preview line shown after the subject in most inboxes. */
  preheader?: string;
  heading: string;
  intro: string;
  lists?: EmailList[];
  /** Paragraph after the lists, before the button. */
  outro?: string;
  button: { label: string; url: string };
  link?: { label: string; url: string };
  /** Sign-off lines, e.g. ["See you on the road,", "The Nalu team"]. The last line is bold. */
  signoff?: string[];
  /** Soft P.S. at the bottom of the card, written without the "P.S." prefix. */
  ps?: string;
};

export type RenderedEmail = { subject: string; html: string; text: string };

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

// Colors. Every text color passes WCAG AA (4.5:1) on the background it sits on.
const C = {
  page: "#eef2f5",
  card: "#ffffff",
  ink: "#08090b",
  body: "#3a434c", // 10.1:1 on white, 9.3:1 on panel
  muted: "#59636d", // 6.1:1 on white, 5.4:1 on page
  link: "#1f6aa5", // 5.7:1 on white, 5.1:1 on page; also the step circles
  button: "#287fc0", // brand sapphire-deep; button text is 19px bold, so the large-text 3:1 rule applies (4.3:1)
  panel: "#f1f7fc",
  panelLine: "#dbe9f5",
  sapphire: "#69b7f5",
  jade: "#68d3a1",
  amber: "#e7b65f",
};

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

const e = escapeHtml;

/** Thin band of brand colors across the top of the card. Solid cells, so Outlook shows it too. */
function accentBar(): string {
  const cell = (color: string, radius: string) =>
    `<td height="6" bgcolor="${color}" style="height:6px;line-height:6px;font-size:0;background:${color};${radius}">&nbsp;</td>`;
  return `<tr><td style="padding:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${cell(
    C.button,
    "border-top-left-radius:16px;",
  )}${cell(C.sapphire, "")}${cell(C.jade, "")}${cell(C.amber, "border-top-right-radius:16px;")}</tr></table></td></tr>`;
}

/** Hidden preview text, padded so the inbox doesn't pull body text in after it. */
function preheaderHtml(text?: string): string {
  if (!text) return "";
  const filler = "&#847;&zwnj;&nbsp;".repeat(60);
  return `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;color:${C.page};">${e(text)}${filler}</div>`;
}

function listHtml(list: EmailList): string {
  const rows = list.items
    .map((item, i) => {
      const marker = list.numbered
        ? `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" valign="middle" width="30" height="30" bgcolor="${C.link}" style="width:30px;height:30px;background:${C.link};border-radius:15px;color:#ffffff;font-family:${FONT};font-size:16px;font-weight:700;line-height:30px;">${i + 1}</td></tr></table>`
        : `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="10" height="10" bgcolor="${C.button}" style="width:10px;height:10px;background:${C.button};border-radius:5px;font-size:0;line-height:0;">&nbsp;</td></tr></table>`;
      const gap = i < list.items.length - 1 ? "padding-bottom:16px;" : "";
      const markerTop = list.numbered ? "" : "padding-top:8px;";
      const body = item.body
        ? `<p style="margin:2px 0 0;font-size:16px;line-height:1.5;color:${C.body};">${e(item.body)}</p>`
        : "";
      const meta = item.meta
        ? `<p style="margin:4px 0 0;font-size:16px;line-height:1.5;font-weight:600;color:${C.link};">${e(item.meta)}</p>`
        : "";
      return `<tr><td width="${list.numbered ? 44 : 24}" valign="top" style="${markerTop}${gap}">${marker}</td><td valign="top" style="${gap}"><p style="margin:${list.numbered ? "3px" : "0"} 0 0;font-size:17px;line-height:1.4;font-weight:700;color:${C.ink};">${e(item.title)}</p>${body}${meta}</td></tr>`;
    })
    .join("");
  const title = list.title
    ? `<p style="margin:0 0 14px;font-size:13px;line-height:1.4;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${C.link};">${e(list.title)}</p>`
    : "";
  const note = list.note
    ? `<p style="margin:14px 0 0;font-size:16px;line-height:1.5;color:${C.body};">${e(list.note)}</p>`
    : "";
  return `<tr><td style="padding:22px 24px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.panel}" style="background:${C.panel};border:1px solid ${C.panelLine};border-radius:14px;"><tr><td style="padding:20px;">${title}<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>${note}</td></tr></table></td></tr>`;
}

export function renderEmail(content: EmailContent, unsubUrl: string): RenderedEmail {
  const shownLists = (content.lists ?? []).filter((l) => l.items.length);
  const lists = shownLists.map(listHtml).join("\n");
  const outro = content.outro
    ? `<tr><td style="padding:22px 32px 0;"><p style="margin:0;font-size:17px;line-height:1.55;color:${C.body};">${e(content.outro)}</p></td></tr>`
    : "";
  const link = content.link
    ? `<tr><td align="center" style="padding:8px 32px 0;"><a href="${e(content.link.url)}" style="font-size:16px;line-height:1.5;color:${C.link};text-decoration:underline;">${e(content.link.label)}</a></td></tr>`
    : "";
  const signoffLines = content.signoff ?? [];
  const signoff = signoffLines.length
    ? `<tr><td style="padding:28px 32px 0;"><p style="margin:0;font-size:17px;line-height:1.55;color:${C.body};">${signoffLines
        .map((line, i) => (i === signoffLines.length - 1 ? `<strong style="color:${C.ink};">${e(line)}</strong>` : e(line)))
        .join("<br>")}</p></td></tr>`
    : "";
  const ps = content.ps
    ? `<tr><td style="padding:24px 32px 0;"><p style="margin:0;padding-top:20px;border-top:1px solid ${C.panelLine};font-size:16px;line-height:1.55;color:${C.body};"><strong style="color:${C.ink};">P.S.</strong> ${e(content.ps)}</p></td></tr>`
    : "";
  const address = MAILING_ADDRESS ? `<br>${e(MAILING_ADDRESS)}` : "";
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only"><title>${e(content.subject)}</title></head>
<body style="margin:0;padding:0;background:${C.page};">
${preheaderHtml(content.preheader)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.page}" style="background:${C.page};padding:32px 16px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.card}" style="max-width:480px;background:${C.card};border-radius:16px;font-family:${FONT};color:${C.ink};">
${accentBar()}
<tr><td align="center" style="padding:30px 32px 8px;"><img src="${LOGO_URL}" width="64" height="64" alt="Nalu" style="display:block;border:0;border-radius:14px;"></td></tr>
<tr><td align="center" style="padding:16px 32px 0;"><h1 style="margin:0;font-size:26px;line-height:1.25;font-weight:700;color:${C.ink};">${e(content.heading)}</h1></td></tr>
<tr><td style="padding:14px 32px 0;"><p style="margin:0;font-size:17px;line-height:1.55;color:${C.body};">${e(content.intro)}</p></td></tr>
${lists}
${outro}
<tr><td align="center" style="padding:28px 32px 8px;"><a href="${e(content.button.url)}" style="display:inline-block;background:${C.button};color:#ffffff;text-decoration:none;font-size:19px;line-height:24px;font-weight:700;padding:16px 40px;border-radius:12px;">${e(content.button.label)}</a></td></tr>
${link}
${signoff}
${ps}
<tr><td style="padding:0 32px 32px;font-size:0;line-height:0;">&nbsp;</td></tr>
</table>
<p style="margin:20px 0 0;font-family:${FONT};font-size:13px;line-height:1.6;color:${C.muted};">You're getting this because you turned on Nalu emails. <a href="${e(unsubUrl)}" style="color:${C.link};">Unsubscribe</a><br>Nalu &middot; Your Oʻahu commute, decided &middot; <a href="${SITE}" style="color:${C.link};">ridenalu.com</a>${address}</p>
</td></tr></table>
</body></html>
`;
  const listText = (l: EmailList) => [
    "",
    ...(l.title ? [l.title.toUpperCase(), ""] : []),
    ...l.items.flatMap((item, i) => [
      `${l.numbered ? `${i + 1}.` : "-"} ${item.title}`,
      ...(item.body ? [`   ${item.body}`] : []),
      ...(item.meta ? [`   ${item.meta}`] : []),
    ]),
    ...(l.note ? ["", l.note] : []),
  ];
  const text = [
    content.heading,
    "",
    content.intro,
    ...shownLists.flatMap(listText),
    ...(content.outro ? ["", content.outro] : []),
    "",
    `${content.button.label}: ${content.button.url}`,
    ...(content.link ? [`${content.link.label}: ${content.link.url}`] : []),
    ...(signoffLines.length ? ["", ...signoffLines] : []),
    ...(content.ps ? ["", `P.S. ${content.ps}`] : []),
    "",
    "---",
    "You're getting this because you turned on Nalu emails.",
    `Unsubscribe: ${unsubUrl}`,
    "Nalu · Your Oʻahu commute, decided · ridenalu.com",
    ...(MAILING_ADDRESS ? [MAILING_ADDRESS] : []),
  ].join("\n");
  return { subject: content.subject, html, text };
}

const TEAM = "The Nalu team";

/** Sent once, right after a rider turns on emails. */
export function welcomeEmail(): EmailContent {
  return {
    subject: "Welcome to Nalu: 3 quick setup steps",
    preheader: "Set it up once, and Nalu can tell you when to leave.",
    heading: "Welcome to Nalu",
    intro:
      "Nalu tells you whether to drive, take the bus or ride Skyline, and when to leave. Three quick steps will set it up for your commute:",
    lists: [
      {
        numbered: true,
        items: [
          {
            title: "Add Nalu to your Home Screen",
            body: "It opens like an app. On iPhone, leave alerts only work this way.",
          },
          {
            title: "Save home and work",
            body: "Your answer is ready as soon as you open Nalu, with no addresses to type.",
          },
          {
            title: "Turn on a leave alert",
            body: "Nalu will let you know when it's time to go.",
          },
        ],
      },
    ],
    button: { label: "Open Nalu", url: `${SITE}/?ref=email_welcome` },
    link: { label: "How to add Nalu to your Home Screen", url: `${SITE}/install?ref=email_welcome` },
    signoff: ["Thanks for using Nalu,", TEAM],
    ps: "The core answer and safety alerts will always be free, and you don't need an account to use them.",
  };
}

/** A planned closure on the rider's route, from the state's HDOT lane-closure list. */
export type RoadClosure = { road: string; where: string; when: string };

/** Longer weeks get a "plus N more" line instead of a wall of text. */
export const WEEK_LIST_MAX = 6;

/** Sunday "your week ahead" email. Draft: not wired to sending yet. */
export function weekAheadEmail(closures: RoadClosure[]): EmailContent {
  const shared = {
    button: { label: "See my route", url: `${SITE}/?ref=email_week` },
    signoff: ["Have a good week,", TEAM],
    ps: "These dates come from the state's HDOT schedule. Crews sometimes finish early or run late, so check Nalu before you go.",
  };
  if (closures.length === 0) {
    return {
      ...shared,
      subject: "No planned roadwork on your route this week",
      preheader: "Nalu will still tell you when to leave each day.",
      heading: "No planned roadwork this week",
      intro: "The state's HDOT list shows no planned lane closures on your usual route this week.",
      outro: "Traffic still changes day to day, so open Nalu before you head out and it will tell you when to leave.",
      ps: "This comes from the state's HDOT schedule, which can change during the week.",
    };
  }
  const shown = closures.slice(0, WEEK_LIST_MAX);
  const extra = closures.length - shown.length;
  const one = closures.length === 1;
  return {
    ...shared,
    subject: `This week on your route: ${one ? "1 planned closure" : `${closures.length} planned closures`}`,
    preheader: "Dates and times from the state's HDOT lane-closure list.",
    heading: "Your week ahead",
    intro: one
      ? "Here is the planned lane closure on your usual route this week, from the state's HDOT list."
      : `Here are the ${closures.length} planned lane closures on your usual route this week, from the state's HDOT list.`,
    lists: [
      {
        title: "On your route",
        items: shown.map((c) => ({ title: c.road, body: c.where, meta: c.when })),
        ...(extra > 0 ? { note: `Plus ${extra} more. You can see them all on your route in Nalu.` } : {}),
      },
    ],
    outro: "When you open Nalu, you'll see these on your route along with when to leave.",
  };
}

/** A big Oʻahu traffic day. Every fact comes from the caller; nothing is assumed. */
export type BigDayEvent = {
  /** e.g. "the Honolulu Marathon" */
  name: string;
  /** Display date, e.g. "Sunday, December 13, 2026" */
  day: string;
  /** Optional area, e.g. "Waikīkī and East Honolulu" */
  area?: string;
  /** Verified facts to share, e.g. closure times from the organizer. */
  details?: string[];
  /** Official page for closures and times. */
  infoUrl?: string;
};

/** Heads-up before a big traffic day. Draft: not wired to sending yet. */
export function bigDayEmail(event: BigDayEvent): EmailContent {
  const where = event.area ? ` around ${event.area}` : "";
  const name = event.name.charAt(0).toUpperCase() + event.name.slice(1);
  const lists: EmailList[] = [];
  if (event.details?.length) {
    lists.push({ title: "What to know", items: event.details.map((d) => ({ title: d })) });
  }
  lists.push({
    title: "Plan your trip",
    numbered: true,
    items: [
      {
        title: "Check Nalu before you head out",
        body: "Compare driving, the bus and Skyline for that day, and choose what works.",
      },
      { title: "Allow extra time", body: "Closures and detours can make trips take longer than usual." },
      { title: "Watch for people walking", body: "Expect more foot traffic near the event." },
    ],
  });
  return {
    subject: `Heads-up: ${event.name} is ${event.day}`,
    preheader: `Roads${where} may be busier than usual that day.`,
    heading: "Plan ahead for a busy day",
    intro: `${name} is ${event.day}${where}. Events like this often bring road closures and heavier traffic, so it helps to plan your trip ahead of time.`,
    lists,
    button: { label: "Plan my trip", url: `${SITE}/?ref=email_bigday` },
    ...(event.infoUrl ? { link: { label: "Official closures and times", url: event.infoUrl } } : {}),
    signoff: ["Take care,", TEAM],
    ps: "Whether you're going to the event or just getting to work, Nalu can help you find the easiest way there.",
  };
}

/** Weekly totals the phone sends; the same numbers as the in-app "Your week" card. */
export type WeekStats = {
  trips: number;
  driveTrips: number;
  transitTrips: number;
  minutesSaved: number;
  averageMinutes: number;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Sunday evening: a short look back at the rider's week with Nalu. */
export function weekWithNaluEmail(stats: WeekStats): EmailContent {
  const saved = stats.minutesSaved > 0;
  const split = [
    stats.driveTrips ? `${stats.driveTrips} by car` : null,
    stats.transitTrips ? `${stats.transitTrips} by bus or rail` : null,
  ].filter(Boolean);
  const items: EmailItem[] = [
    { title: plural(stats.trips, "trip", "trips"), ...(split.length ? { body: split.join(", ") } : {}) },
    { title: `About ${plural(stats.averageMinutes, "minute", "minutes")} per trip`, body: "From start to finish, on average" },
  ];
  if (saved) {
    items.push({
      title: `About ${plural(stats.minutesSaved, "minute", "minutes")} saved`,
      body: "Compared with the other option, based on Nalu's estimates when you left",
    });
  }
  return {
    subject: saved
      ? `Your week with Nalu: about ${plural(stats.minutesSaved, "minute", "minutes")} saved`
      : `Your week with Nalu: ${plural(stats.trips, "trip", "trips")}`,
    preheader: "A quick look at the trips you took with Nalu this week.",
    heading: "Your week with Nalu",
    intro: "Here's a quick look at the trips you took with Nalu this week.",
    lists: [{ title: "This week", items }],
    outro: "Nalu only counts trips you start and end in the app, so your real total may be higher.",
    button: { label: "Plan my next trip", url: `${SITE}/?ref=email_weekly` },
    signoff: ["Have a good week ahead,", TEAM],
    ps: "These totals are worked out on your phone. Nalu receives only the numbers, never where you went.",
  };
}

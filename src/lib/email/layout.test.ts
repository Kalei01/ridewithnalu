import { describe, expect, it } from "vitest";
import {
  bigDayEmail,
  escapeHtml,
  renderEmail,
  unsubscribeUrl,
  weekAheadEmail,
  welcomeEmail,
  WEEK_LIST_MAX,
  type RoadClosure,
} from "./layout";

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

describe("Nalu emails", () => {
  const unsub = unsubscribeUrl("3f2b8c1e-0000-4000-8000-000000000001");

  it("builds the unsubscribe link on ridenalu.com", () => {
    expect(unsub).toBe("https://ridenalu.com/api/public/unsubscribe?t=3f2b8c1e-0000-4000-8000-000000000001");
  });

  it("puts the logo, button, steps and unsubscribe link in the welcome email", () => {
    const email = renderEmail(welcomeEmail(), unsub);
    expect(email.html).toContain("https://ridenalu.com/icons/icon-192.png");
    expect(email.html).toContain("Open Nalu");
    expect(email.html).toContain("Save home and work");
    expect(email.html).toContain(unsub);
    expect(email.text).toContain(`Unsubscribe: ${unsub}`);
    expect(email.text).toContain("1. Add Nalu to your Home Screen");
    expect(email.text).toContain("3. Turn on a leave alert");
  });

  it("gives the welcome email a preheader, a sign-off and a P.S.", () => {
    const content = welcomeEmail();
    const email = renderEmail(content, unsub);
    expect(content.preheader).toBeTruthy();
    expect(email.html).toContain("display:none");
    expect(email.html).toContain(escapeHtml(content.preheader!));
    expect(email.text).toContain("The Nalu team");
    expect(email.text).toMatch(/^P\.S\. .*free/m);
    expect(email.html).toContain("https://ridenalu.com/install?ref=email_welcome");
  });

  it("keeps the welcome email short and scannable", () => {
    const c = welcomeEmail();
    const body = [
      c.heading,
      c.intro,
      ...(c.lists ?? []).flatMap((l) => l.items.flatMap((i) => [i.title, i.body ?? ""])),
      ...(c.signoff ?? []),
      c.ps ?? "",
    ].join(" ");
    expect(words(body)).toBeGreaterThanOrEqual(100);
    expect(words(body)).toBeLessThanOrEqual(140);
  });

  it("keeps Hawaiian words out of the marketing filler and subjects calm", () => {
    const all = [welcomeEmail(), weekAheadEmail([]), weekAheadEmail([{ road: "r", where: "w", when: "t" }]), bigDayEmail({ name: "the parade", day: "Saturday" })];
    for (const c of all) {
      const { text } = renderEmail(c, unsub);
      expect(text).not.toMatch(/\b(aloha|mahalo)\b/i);
      expect(c.subject).not.toContain("!");
    }
  });

  it("never guesses a name and spells Oʻahu with the ʻokina", () => {
    for (const c of [welcomeEmail(), weekAheadEmail([]), bigDayEmail({ name: "the parade", day: "Saturday" })]) {
      const { html, text } = renderEmail(c, unsub);
      expect(text).not.toMatch(/\{name\}|Hi there|Dear/);
      expect(html).not.toMatch(/Oahu/);
      expect(text).toContain("Oʻahu");
    }
  });

  it("escapes text so nothing can inject HTML", () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
    const email = renderEmail(
      {
        ...welcomeEmail(),
        heading: "<script>",
        preheader: "<img onerror=x>",
        signoff: ["<b>"],
        ps: "<i>",
        lists: [{ title: "<u>", items: [{ title: "<p>", body: "<em>" }], note: "<s>" }],
      },
      unsub,
    );
    for (const tag of ["<script>", "<img onerror", "<b>", "<i>", "<u>", "<em>", "<s>"]) {
      expect(email.html).not.toContain(tag);
    }
  });

  it("omits optional parts when they're not given", () => {
    const { html, text } = renderEmail(
      { subject: "s", heading: "h", intro: "i", button: { label: "Go", url: "https://ridenalu.com" } },
      unsub,
    );
    expect(html).not.toContain("display:none");
    expect(html).not.toContain("P.S.");
    expect(text).not.toContain("P.S.");
  });

  it("keeps body text at 16px or larger", () => {
    const { html } = renderEmail(bigDayEmail({ name: "x", day: "y", details: ["z"] }), unsub);
    const body = html.split("</table>\n<p")[0] ?? ""; // card only, not the small footer
    const sizes = [...body.matchAll(/font-size:(\d+)px/g)].map((m) => Number(m[1]));
    // 0px spacer cells, 1px preheader and the 13px list label are the only exceptions
    expect(sizes.filter((s) => s > 1 && s < 16 && s !== 13)).toEqual([]);
  });
});

describe("week ahead email", () => {
  const unsub = unsubscribeUrl("t");
  const closures: RoadClosure[] = [
    { road: "H-1 Eastbound", where: "Kunia to Waiawa, 2 right lanes", when: "Mon to Thu, 8:30 p.m. to 4:30 a.m." },
    { road: "Farrington Highway", where: "Near Fort Weaver Road, 1 lane", when: "Tue, 9 a.m. to 3 p.m." },
  ];

  it("lists each closure with where and when", () => {
    const content = weekAheadEmail(closures);
    const { html, text } = renderEmail(content, unsub);
    expect(content.subject).toBe("This week on your route: 2 planned closures");
    expect(html).toContain("H-1 Eastbound");
    expect(text).toContain("- Farrington Highway");
    expect(text).toContain("- Farrington Highway\n   Near Fort Weaver Road, 1 lane\n   Tue, 9 a.m. to 3 p.m.");
    expect(text).toContain("HDOT");
    expect(text).toContain("The Nalu team");
  });

  it("uses the singular for one closure", () => {
    expect(weekAheadEmail(closures.slice(0, 1)).subject).toBe("This week on your route: 1 planned closure");
  });

  it("sends a short note when the route is clear", () => {
    const content = weekAheadEmail([]);
    expect(content.subject).toBe("No planned roadwork on your route this week");
    expect(content.lists).toBeUndefined();
    expect(renderEmail(content, unsub).text).toContain("no planned lane closures");
  });

  it("caps a long week and points to the rest in Nalu", () => {
    const many = Array.from({ length: WEEK_LIST_MAX + 3 }, (_, i) => ({ road: `Road ${i}`, where: "w", when: "t" }));
    const { text } = renderEmail(weekAheadEmail(many), unsub);
    expect(text).toContain(`Road ${WEEK_LIST_MAX - 1}`);
    expect(text).not.toContain(`Road ${WEEK_LIST_MAX}\n`);
    expect(text).toContain("Plus 3 more.");
  });

  it("escapes closure text from the HDOT feed", () => {
    const { html } = renderEmail(weekAheadEmail([{ road: "<b>H-1</b>", where: "a & b", when: "now" }]), unsub);
    expect(html).toContain("&lt;b&gt;H-1&lt;/b&gt;");
    expect(html).toContain("a &amp; b");
  });
});

describe("big day email", () => {
  const unsub = unsubscribeUrl("t");
  const marathon = { name: "the Honolulu Marathon", day: "Sunday, December 13, 2026" };

  it("builds the heads-up only from the fields it's given", () => {
    const content = bigDayEmail(marathon);
    const { text } = renderEmail(content, unsub);
    expect(content.subject).toBe("Heads-up: the Honolulu Marathon is Sunday, December 13, 2026");
    expect(text).toContain("The Honolulu Marathon is Sunday, December 13, 2026.");
    expect(text).not.toContain("WHAT TO KNOW");
    expect(text).not.toContain("Official closures");
    expect(text).toContain("1. Check Nalu before you head out");
  });

  it("adds the area, verified details and official link when given", () => {
    const content = bigDayEmail({
      ...marathon,
      area: "Waikīkī",
      details: ["Some roads close early in the morning."],
      infoUrl: "https://example.org/closures",
    });
    const { html, text } = renderEmail(content, unsub);
    expect(content.preheader).toContain("around Waikīkī");
    expect(text).toContain("WHAT TO KNOW");
    expect(text).toContain("- Some roads close early in the morning.");
    expect(html).toContain('href="https://example.org/closures"');
  });
});

describe("weekly time-saved email", () => {
  it("leads with minutes saved when there are some", async () => {
    const { weekWithNaluEmail, renderEmail, unsubscribeUrl } = await import("./layout");
    const content = weekWithNaluEmail({ trips: 4, driveTrips: 3, transitTrips: 1, minutesSaved: 25, averageMinutes: 32 });
    expect(content.subject).toBe("Your week with Nalu: about 25 minutes saved");
    const email = renderEmail(content, unsubscribeUrl("3f2b8c1e-0000-4000-8000-000000000001"));
    expect(email.text).toContain("3 by car, 1 by bus or rail");
    expect(email.text).toContain("based on Nalu's estimates when you left");
  });

  it("doesn't mention savings when there were none", async () => {
    const { weekWithNaluEmail } = await import("./layout");
    const content = weekWithNaluEmail({ trips: 1, driveTrips: 1, transitTrips: 0, minutesSaved: 0, averageMinutes: 28 });
    expect(content.subject).toBe("Your week with Nalu: 1 trip");
    expect(JSON.stringify(content)).not.toContain("saved");
  });
});

describe("account vs marketing emails", () => {
  it("keeps marketing emails off while no postal address is set", async () => {
    const { canSendMarketing, MAILING_ADDRESS } = await import("./layout");
    expect(canSendMarketing()).toBe(MAILING_ADDRESS.trim().length > 0);
  });

  it("keeps the weekly summary free of promotion", async () => {
    const { weekWithNaluEmail } = await import("./layout");
    const content = weekWithNaluEmail({ trips: 2, driveTrips: 2, transitTrips: 0, minutesSaved: 10, averageMinutes: 30 });
    expect(content.button.label).toBe("Open Nalu");
  });
});

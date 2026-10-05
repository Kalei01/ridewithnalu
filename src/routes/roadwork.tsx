import { LegalFooter } from "@/components/LegalFooter";
import { Link, createFileRoute } from "@tanstack/react-router";
import { HDOT_OAHU_ROADWORK_URL } from "@/lib/hdot-lane-closures.functions";
import { directionLabel, groupRoadwork, tidyClosure } from "@/lib/roadwork";
import { getOahuRoadwork } from "@/lib/roadwork.functions";
import { SITE_URL } from "@/lib/site";

const PAGE_URL = SITE_URL + "/roadwork";
const TITLE = "Oʻahu Roadwork This Week: Freeway Lane Closures | Nalu";
const DESCRIPTION =
  "Planned lane closures on H-1, H-2, H-3, Moanalua Freeway and other Oʻahu highways this week, from the state's HDOT schedule. Updated through the day.";

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "Where does this list come from?",
    a: "From the Hawaiʻi Department of Transportation's weekly Oʻahu roadwork schedule. Nalu reads it, removes entries whose dates have passed, and groups the rest by road.",
  },
  {
    q: "How often is it updated?",
    a: "Nalu checks the state's list about every 30 minutes. HDOT usually publishes the schedule weekly and sometimes adds or changes entries during the week.",
  },
  {
    q: "Will these closures affect my commute?",
    a: "Check the times: a closure scheduled overnight won't affect a daytime drive. Open Nalu with your trip and it shows only the closures on your route, along with whether driving or transit is faster right now.",
  },
  {
    q: "Are the dates guaranteed?",
    a: "No. Crews can finish early, run late, or reschedule for weather. Treat this as a planning guide and check before you go.",
  },
];

export const Route = createFileRoute("/roadwork")({
  loader: () => getOahuRoadwork(),
  head: ({ loaderData }) => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "index,follow" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Oʻahu roadwork this week" },
      { property: "og:description", content: "Planned freeway and highway lane closures on Oʻahu, from the state's HDOT schedule." },
      { property: "og:url", content: PAGE_URL },
      { property: "og:image", content: SITE_URL + "/social-card.png" },
    ],
    links: [{ rel: "canonical", href: PAGE_URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebPage",
              name: "Oʻahu roadwork this week",
              url: PAGE_URL,
              description: DESCRIPTION,
              ...(loaderData?.ok ? { dateModified: loaderData.fetchedAt } : {}),
              isPartOf: { "@type": "WebSite", name: "Nalu", url: SITE_URL },
              about: { "@type": "Thing", name: "Road construction lane closures on Oʻahu, Hawaiʻi" },
              isBasedOn: HDOT_OAHU_ROADWORK_URL,
              breadcrumb: {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Nalu", item: SITE_URL },
                  { "@type": "ListItem", position: 2, name: "Oʻahu roadwork this week", item: PAGE_URL },
                ],
              },
            },
            {
              "@type": "FAQPage",
              mainEntity: FAQS.map((item) => ({
                "@type": "Question",
                name: item.q,
                acceptedAnswer: { "@type": "Answer", text: item.a },
              })),
            },
          ],
        }),
      },
    ],
  }),
  component: RoadworkPage,
});

function updatedLabel(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Pacific/Honolulu",
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function RoadworkPage() {
  const data = Route.useLoaderData();
  const groups = groupRoadwork(data.closures);
  const count = data.closures.length;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8 sm:py-16">
        <Link
          to="/"
          className="text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          ← Open Nalu
        </Link>

        <header className="mt-10">
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Oʻahu roadwork this week</h1>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">
            {data.ok && count > 0
              ? `${count} planned lane ${count === 1 ? "closure" : "closures"} on Oʻahu freeways and highways, from the state's HDOT weekly schedule.`
              : data.ok
                ? "The state's HDOT weekly schedule lists no upcoming lane closures right now."
                : "The state's HDOT schedule couldn't be loaded just now."}
          </p>
          <p className="mt-3 text-base text-muted-foreground">
            {data.ok ? <>Checked {updatedLabel(data.fetchedAt)} (Honolulu time). </> : null}
            Source:{" "}
            <a href={HDOT_OAHU_ROADWORK_URL} className="font-semibold text-primary underline underline-offset-4" rel="noopener">
              HDOT Oʻahu roadwork
            </a>
          </p>
        </header>

        <Link
          to="/"
          className="liquid-primary-action mt-8 inline-flex min-h-14 items-center justify-center rounded-2xl px-6 text-base font-bold"
        >
          See only the closures on my route
        </Link>

        {groups.map((group) => (
          <section key={group.route} className="mt-10" aria-labelledby={`road-${group.route}`}>
            <h2 id={`road-${group.route}`} className="text-2xl font-bold">
              {group.name}
              {group.code ? <span className="ml-2 text-base font-medium text-muted-foreground">({group.code})</span> : null}
            </h2>
            <ul className="mt-4 grid gap-3">
              {group.closures.map((closure, index) => {
                const tidy = tidyClosure(closure);
                return (
                  <li key={`${closure.location}-${index}`} className="rounded-2xl border border-border p-4">
                    <p className="text-base font-semibold text-muted-foreground">
                      {[tidy.place, directionLabel(closure.direction)].filter(Boolean).join(" · ")}
                    </p>
                    <p className="mt-1 text-lg font-semibold leading-7">{tidy.what}</p>
                    <p className="mt-1 text-base leading-7">
                      {tidy.lanes} · {tidy.when}
                    </p>
                    {tidy.why || tidy.link ? (
                      <p className="mt-1 text-base leading-7 text-muted-foreground">
                        {tidy.why ? <>For {tidy.why.charAt(0).toLowerCase() + tidy.why.slice(1)}. </> : null}
                        {tidy.link ? (
                          <a href={tidy.link} className="font-semibold text-primary underline underline-offset-4" rel="noopener nofollow">
                            More details
                          </a>
                        ) : null}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        <section className="mt-12" aria-labelledby="questions">
          <h2 id="questions" className="text-2xl font-bold">Questions</h2>
          <div className="mt-4 grid gap-5">
            {FAQS.map((item) => (
              <div key={item.q}>
                <h3 className="text-lg font-semibold">{item.q}</h3>
                <p className="mt-1 text-base leading-7 text-muted-foreground">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <p className="mt-10 text-base leading-7 text-muted-foreground">
          More Oʻahu commute help:{" "}
          <Link to="/oahu-commute" className="font-semibold text-primary underline underline-offset-4">
            Skyline and drive vs. transit guide
          </Link>{" "}
          ·{" "}
          <Link to="/install" className="font-semibold text-primary underline underline-offset-4">
            Install Nalu
          </Link>
        </p>
      </div>
      <LegalFooter />
    </main>
  );
}

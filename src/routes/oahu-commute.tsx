import { LegalFooter } from "@/components/LegalFooter";
import { Link, createFileRoute } from "@tanstack/react-router";

const SITE_URL = "https://ridewithnalu.lovable.app";

export const Route = createFileRoute("/oahu-commute")({
  head: () => ({
    meta: [
      { title: "Oʻahu Commute Planner | Nalu" },
      {
        name: "description",
        content:
          "Nalu is an Oʻahu commute planner that compares driving, Skyline rail, and TheBus so commuters can make a clear trip decision.",
      },
      { name: "robots", content: "index,follow,max-image-preview:large" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Oʻahu Commute Planner | Nalu" },
      {
        property: "og:description",
        content:
          "Compare driving, Skyline rail, and TheBus for an Oʻahu commute with Nalu.",
      },
      { property: "og:url", content: SITE_URL + "/oahu-commute" },
    ],
    links: [{ rel: "canonical", href: SITE_URL + "/oahu-commute" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "Oʻahu Commute Planner",
          url: SITE_URL + "/oahu-commute",
          description:
            "An overview of how Nalu helps Oʻahu commuters compare driving, Skyline rail, and TheBus.",
          isPartOf: { "@type": "WebSite", name: "Nalu", url: SITE_URL },
          about: {
            "@type": "Thing",
            name: "Oʻahu commuting",
          },
        }),
      },
    ],
  }),
  component: OahuCommutePage,
});

function OahuCommutePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-16">
        <Link
          to="/"
          className="text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          ← Open Nalu
        </Link>

        <header className="mt-10">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
            Nalu · Oʻahu
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            Oʻahu commute planning without the guesswork
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
            Nalu helps Oʻahu commuters compare the trip that makes the most sense right now:
            driving, Skyline rail, and TheBus. Instead of making you interpret several apps,
            Nalu puts the commute decision in one place.
          </p>
        </header>

        <section className="mt-12 grid gap-8" aria-labelledby="how-it-works">
          <div>
            <h2 id="how-it-works" className="text-2xl font-bold">
              How Nalu compares an Oʻahu commute
            </h2>
            <p className="mt-3 leading-7 text-muted-foreground">
              Nalu considers current drive conditions and available transit information,
              including Skyline and TheBus schedules, then compares the trip from your starting
              point to your destination. When information is unavailable or uncertain, Nalu
              identifies that instead of pretending the data is more precise than it is.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold">Skyline or driving?</h2>
            <p className="mt-3 leading-7 text-muted-foreground">
              The fastest-looking option is not always the simplest trip. A transit trip can
              include getting to a station, waiting for a train, changing rides, and walking
              at the other end. A driving trip can change with traffic, crashes, roadwork,
              lane closures, and other incidents. Nalu is designed to put those pieces into
              one comparable trip view.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold">Built around real Oʻahu travel</h2>
            <p className="mt-3 leading-7 text-muted-foreground">
              Nalu is focused on Oʻahu rather than trying to be a general-purpose map. It is
              designed around the practical question local commuters ask before leaving:
              should I drive or take rail and bus for this trip?
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold">Plan around when you need to arrive</h2>
            <p className="mt-3 leading-7 text-muted-foreground">
              Nalu also supports Arrive By planning, so a commuter can work backward from a
              desired arrival time instead of simply asking what is fastest at this exact
              moment.
            </p>
          </div>
        </section>

        <section className="mt-12 rounded-2xl border border-border bg-card/60 p-6" aria-labelledby="data">
          <h2 id="data" className="text-xl font-bold">Live information and sources</h2>
          <p className="mt-3 leading-7 text-muted-foreground">
            Nalu combines commute information from services used for traffic, transit,
            weather, and air quality. Availability and freshness can vary, so the app shows
            when current information is unavailable or ne<LegalFooter />            Try Nalu
          </Link>
        </footer>
      </div>
    </main>
  );
}

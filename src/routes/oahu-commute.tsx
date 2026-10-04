import { LegalFooter } from "@/components/LegalFooter";
import { Link, createFileRoute } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site";
import { HOLO_FARES } from "@/lib/fares";

// Facts below come from TheBus's GTFS timetable (checked October 2026) and the
// HOLO fare table in src/lib/fares.ts. Update them when the timetable changes.
const SKYLINE_STATIONS = [
  "Kualakaʻi (East Kapolei)",
  "Keoneʻae (UH West Oʻahu)",
  "Honouliuli (Hoʻopili)",
  "Hoʻaeʻae (West Loch)",
  "Pouhala (Waipahu Transit Center)",
  "Halaulani (Leeward Community College)",
  "Waiawa (Pearl Highlands)",
  "Kalauao (Pearlridge)",
  "Halawa (Aloha Stadium)",
  "Makalapa (Pearl Harbor–Hickam)",
  "Lelepaua (Daniel K. Inouye International Airport)",
  "Ahua (Lagoon Drive)",
  "Kahauiki (Kalihi Transit Center)",
];

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "What are Skyline's hours?",
    a: "Skyline runs every day, with the first trains around 4:00 AM and the last around 10:35 PM. Trains come about every 10 minutes for most of the day and less often late in the evening.",
  },
  {
    q: "Where does Skyline go?",
    a: `Skyline currently runs between Kualakaʻi (East Kapolei) and Kahauiki (Kalihi Transit Center), with ${SKYLINE_STATIONS.length} stations including Pearlridge, Aloha Stadium and the airport. To reach downtown Honolulu, riders transfer to TheBus.`,
  },
  {
    q: "How much does Skyline cost?",
    a: `A single ride is ${HOLO_FARES.singleRide} with a HOLO card, and it includes free transfers between TheBus and Skyline for ${HOLO_FARES.transferWindowHours} hours.`,
  },
  {
    q: "Is it faster to drive or take the bus or Skyline on Oʻahu?",
    a: "It depends on the trip and the time. Outside rush hour, driving is usually faster. In heavy H-1 traffic, Skyline or an express bus can win, especially along the Leeward side. Nalu checks live traffic and the current timetable for your exact trip and tells you which is faster right now.",
  },
  {
    q: "Is Nalu free?",
    a: "Yes. Nalu is free and works without an account. A free account only saves places like Home and Work.",
  },
];


export const Route = createFileRoute("/oahu-commute")({
  head: () => ({
    meta: [
      { title: "Oʻahu Commute Guide: Skyline Hours, Fares & Drive vs. Bus | Nalu" },
      {
        name: "description",
        content:
          "Skyline hours, stations and HOLO fares, plus how to decide between driving, TheBus and Skyline on Oʻahu. Nalu checks live traffic and the timetable for your trip.",
      },
      { name: "robots", content: "index,follow,max-image-preview:large" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Oʻahu Commute Guide | Nalu" },
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
          "@graph": [
            {
              "@type": "WebPage",
              name: "Oʻahu Commute Guide: Skyline, TheBus and Driving",
              url: SITE_URL + "/oahu-commute",
              description:
                "Skyline hours, stations and fares, and how Nalu compares driving with TheBus and Skyline for an Oʻahu commute.",
              isPartOf: { "@type": "WebSite", name: "Nalu", url: SITE_URL },
              about: { "@type": "Thing", name: "Oʻahu commuting" },
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
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">
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

        <section className="mt-12" aria-labelledby="skyline">
          <h2 id="skyline" className="text-2xl font-bold">Skyline at a glance</h2>
          <ul className="mt-4 grid gap-2 leading-7 text-muted-foreground">
            <li><span className="font-semibold text-foreground">Hours:</span> every day, about 4:00 AM to 10:35 PM.</li>
            <li><span className="font-semibold text-foreground">How often:</span> about every 10 minutes most of the day; less often late evening.</li>
            <li><span className="font-semibold text-foreground">Fare:</span> {HOLO_FARES.singleRide} with a HOLO card, with free TheBus–Skyline transfers for {HOLO_FARES.transferWindowHours} hours.</li>
            <li><span className="font-semibold text-foreground">Route:</span> East Kapolei to Kalihi Transit Center. Downtown Honolulu is a TheBus connection from there.</li>
          </ul>
          <h3 className="mt-6 text-lg font-semibold">Stations, west to east</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-6 leading-7 text-muted-foreground">
            {SKYLINE_STATIONS.map((station) => (
              <li key={station}>{station}</li>
            ))}
          </ol>
          <p className="mt-3 text-sm text-muted-foreground">Source: TheBus timetable, October 2026.</p>
        </section>

        <section className="mt-12" aria-labelledby="questions">
          <h2 id="questions" className="text-2xl font-bold">Common questions</h2>
          <div className="mt-4 grid gap-5">
            {FAQS.map((item) => (
              <div key={item.q}>
                <h3 className="text-lg font-semibold">{item.q}</h3>
                <p className="mt-1 leading-7 text-muted-foreground">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <Link
          to="/"
          className="liquid-primary-action mt-10 inline-flex min-h-14 items-center justify-center rounded-2xl px-6 text-base font-bold"
        >
          Check your trip in Nalu
        </Link>

        <section className="mt-12 rounded-2xl border border-border bg-card/60 p-6" aria-labelledby="data">
          <h2 id="data" className="text-xl font-bold">Live information and sources</h2>
          <p className="mt-3 leading-7 text-muted-foreground">
            Driving times come from TomTom live traffic. Bus and Skyline times come from
            TheBus’s official timetable, with live TheBus arrival estimates where available.
            Weather comes from the National Weather Service. When information is missing or
            out of date, Nalu says so.
          </p>
        </section>

        <LegalFooter />
      </div>
    </main>
  );
}

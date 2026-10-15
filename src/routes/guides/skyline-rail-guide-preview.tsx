import { Link, createFileRoute } from "@tanstack/react-router";
import { Bus, CarFront, ChevronDown } from "lucide-react";
import {
  SkylineMap,
  type SkylineMapLabel,
  type SkylineMapPin,
} from "@/components/guides/SkylineMap";
import { GUIDES } from "@/components/guides/guides";
import { DOWNTOWN } from "@/components/guides/destinations";
import { TryTripPanel } from "@/components/guides/TryTripPanel";
import { guideHead, type GuideFaq } from "@/components/guides/guide-head";
import { B, Ext, GuideLayout, GuideList, GuideTable } from "@/components/guides/GuideLayout";
import "@/components/guides/skyline-parking.css";

/**
 * PREVIEW of /guides/skyline-rail-guide (redesign for Josh to look at on a phone
 * before it replaces the real page). noindex; canonical is the real page; not in
 * the sitemap and not linked. Every sentence, number and section id of the real
 * page is kept; the station table and the line diagram became a map plus one
 * card per area of the line.
 */

// Sources (checked October 2026): TheBus GTFS timetable valid Sept 28 to Dec 5, 2026
// (station order, minutes between stations, first and last trains, frequency, bus
// connections); thebus.org fare table; City and County of Honolulu Skyline pages
// (park-and-ride, luggage and bike rules) and station pages (stall counts, checked
// October 5, 2026); Hawaii News Now, May 8, 2026 (Keoneʻae parking); Honolulu Star-Advertiser, March 3, 2026 (Segment 3 schedule).
const META = GUIDES.skyline;

const FAQS: GuideFaq[] = [
  {
    q: "What are Skyline's hours?",
    a: "Skyline runs every day, including weekends and holidays, from about 4:00 AM to 10:30 PM. Trains come every 10 minutes until about 8:30 PM and every 15 minutes after that. The last trains that run the whole line leave each end at about 10:00 PM.",
  },
  {
    q: "Does Skyline go to downtown Honolulu or Waikīkī?",
    a: "Not yet. Skyline ends at Kalihi Transit Center (Kahauiki). To reach downtown, Ala Moana or Waikīkī, transfer to TheBus, for example the A Line or W Line at Lagoon Drive (Ahua) station. The extension to Civic Center in Kakaʻako is scheduled for 2031.",
  },
  {
    q: "How much does Skyline cost?",
    a: "Skyline costs the same as TheBus: $3.00 for an adult with a HOLO card, which works as a 2-hour pass for transfers between TheBus and Skyline. Adult fares stop at $7.50 a day. Youth and senior fares are lower.",
  },
  {
    q: "Where can I park for Skyline?",
    a: "The city runs free park-and-ride lots for transit riders at four stations: UH West Oʻahu (Keoneʻae), Hoʻopili (Honouliuli), Aloha Stadium (Hālawa) and Kalihi Transit Center (Kahauiki), with a 24-hour limit. The Keoneʻae lot has been filling by about 8 AM on weekdays.",
  },
  {
    q: "Can I bring a suitcase on Skyline?",
    a: "Yes. The city's rules allow one standard suitcase and one smaller carry-on bag per rider, kept in front of or next to you and out of the aisle.",
  },
];

export const Route = createFileRoute("/guides/skyline-rail-guide-preview")({
  head: () => {
    const head = guideHead({ ...META, faqs: FAQS });
    return {
      ...head,
      meta: head.meta.map((m) =>
        "name" in m && m.name === "robots" ? { ...m, content: "noindex,nofollow" } : m,
      ),
    };
  },
  component: SkylineGuidePreview,
});

type Station = {
  id: string;
  english: string;
  hawaiian: string;
  minutes: number;
  buses: string;
  lot?: boolean;
};

// Minutes are from TheBus GTFS (eastbound trip from Kualakaʻi). Connections are
// TheBus routes with stops at or right beside each station.
const AREAS: Array<{ n: string; title: string; stations: Station[] }> = [
  {
    n: "1",
    title: "Kapolei and ʻEwa end",
    stations: [
      {
        id: "10047",
        english: "East Kapolei",
        hawaiian: "Kualakaʻi",
        minutes: 0,
        buses: "C, 44, 46, 47, 95, 416",
      },
      {
        id: "10046",
        english: "UH West Oʻahu",
        hawaiian: "Keoneʻae",
        minutes: 2,
        buses: "C, 40, 44, 46, 47, 95, 99",
        lot: true,
      },
      {
        id: "10045",
        english: "Hoʻopili",
        hawaiian: "Honouliuli",
        minutes: 4,
        buses: "",
        lot: true,
      },
    ],
  },
  {
    n: "2",
    title: "Waipahu and Pearl Highlands",
    stations: [
      { id: "10044", english: "West Loch", hawaiian: "Hōʻaeʻae", minutes: 7, buses: "44" },
      {
        id: "10043",
        english: "Waipahu Transit Center",
        hawaiian: "Pouhala",
        minutes: 10,
        buses: "E, 40, 42, 43, 99",
      },
      {
        id: "10056",
        english: "Leeward Community College",
        hawaiian: "Halaulani",
        minutes: 13,
        buses: "",
      },
      {
        id: "10053",
        english: "Pearl Highlands",
        hawaiian: "Waiawa",
        minutes: 14,
        buses: "40, 42, 43, 51, 88A",
      },
    ],
  },
  {
    n: "3",
    title: "Pearl Harbor and Aloha Stadium",
    stations: [
      {
        id: "10054",
        english: "Pearlridge",
        hawaiian: "Kalauao",
        minutes: 18,
        buses: "32, 40, 42, 51, 53",
      },
      {
        id: "10055",
        english: "Aloha Stadium",
        hawaiian: "Hālawa",
        minutes: 22,
        buses: "1L, 32, 40, 42, 51",
        lot: true,
      },
      {
        id: "10033",
        english: "Joint Base Pearl Harbor–Hickam",
        hawaiian: "Makalapa",
        minutes: 24,
        buses: "",
      },
    ],
  },
  {
    n: "4",
    title: "Airport and the town end",
    stations: [
      {
        id: "10032",
        english: "Daniel K. Inouye International Airport",
        hawaiian: "Lelepaua",
        minutes: 28,
        buses: "W Line, 40, 42, 51",
      },
      {
        id: "10031",
        english: "Lagoon Drive",
        hawaiian: "Ahua",
        minutes: 32,
        buses: "A Line, U Line, W Line, 40, 42, 51",
      },
      {
        id: "10030",
        english: "Kalihi Transit Center",
        hawaiian: "Kahauiki",
        minutes: 34,
        buses: "1, 2, 52, C, 40, 42, 51 and others",
        lot: true,
      },
    ],
  },
];

// One numbered pin per area, on a station inside it; the other stations are dots.
const PINS: SkylineMapPin[] = [
  { id: "10046", mark: "1", dx: -8, dy: 4, anchor: "end" },
  { id: "10043", mark: "2", dy: -8 },
  { id: "10055", mark: "3", dy: -8 },
  { id: "10032", mark: "4", dx: -2, dy: -8 },
];

const ENDS: SkylineMapLabel[] = [
  { id: "10047", text: "East Kapolei", dy: 12 },
  { id: "10030", text: "Kalihi Transit Center", dx: -6, dy: 12, anchor: "end" },
];

function Name({ s }: { s: Station }) {
  return (
    <>
      <span className="font-semibold text-foreground">{s.english}</span>{" "}
      <span className="text-sm font-normal text-muted-foreground">({s.hawaiian})</span>
    </>
  );
}

function Chevron() {
  return (
    <ChevronDown
      className="size-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
      aria-hidden="true"
    />
  );
}

const SUMMARY =
  "flex min-h-12 cursor-pointer list-none items-center px-4 text-base font-semibold text-foreground [&::-webkit-details-marker]:hidden";

/** A section with Nalu's usual heading id, its content on glow cards. */
function Sg({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <h2 id={id} className="text-2xl font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}

const CARD_TEXT = "sg-card grid gap-3 p-4 text-base leading-7 text-muted-foreground sm:p-5";

function SkylineGuidePreview() {
  return (
    <GuideLayout
      breadcrumb="Skyline rail guide"
      title="Skyline rail guide: hours, stations and fares"
      faqs={FAQS}
      related={["parking", "airport", "kapolei"]}
      intro={
        <>
          <p>
            Skyline, Honolulu's rail line, runs between East Kapolei (Kualakaʻi) and Kalihi Transit
            Center (Kahauiki), with 13 stations including the airport.
          </p>
          <p className="mt-4">
            This is the detailed version of our{" "}
            <Link
              to="/oahu-commute"
              className="font-medium text-primary underline underline-offset-4"
            >
              Oʻahu commute guide
            </Link>
            , with every station, the minutes between them, fares, parking and what you can bring.
          </p>
        </>
      }
    >
      <div className="nh sg grid grid-cols-[minmax(0,1fr)] gap-10">
        <section aria-labelledby="know" className="grid gap-3">
          <h2 id="know" className="text-2xl font-bold">
            What to know
          </h2>
          <ul className="grid grid-cols-2 gap-3 text-base leading-6 text-muted-foreground">
            <li className="sg-card p-4">
              <span className="block text-lg font-bold text-foreground">Every day</span>
              About 4:00 AM to 10:30 PM
            </li>
            <li className="sg-card p-4">
              <span className="block text-lg font-bold text-foreground">Every 10 min</span>
              Until about 8:30 PM, then every 15
            </li>
            <li className="sg-card p-4">
              <span className="block text-lg font-bold text-foreground">$3.00</span>
              Adult, with a HOLO card
            </li>
            <li className="sg-card p-4">
              <span className="block text-lg font-bold text-foreground">Not downtown yet</span>
              Ends at Kalihi; TheBus finishes the trip
            </li>
          </ul>
        </section>

        <TryTripPanel destination={DOWNTOWN} />

        <Sg id="open-now" title="What is open now">
          <div className={CARD_TEXT}>
            <p>
              All 13 stations from East Kapolei (Kualakaʻi) to Kalihi Transit Center (Kahauiki) are
              open. The first 9 stations opened in June 2023. Joint Base Pearl Harbor–Hickam
              (Makalapa), the airport (Lelepaua), Lagoon Drive (Ahua) and Kalihi Transit Center
              (Kahauiki) opened on October 16, 2025.
            </p>
            <p>
              Skyline does not reach downtown Honolulu yet. The next section, from Kalihi to Civic
              Center station in Kakaʻako, has a scheduled opening of March 2031, and the Honolulu
              Star-Advertiser reported in March 2026 that a design delay could push that date back.
            </p>
          </div>
        </Sg>

        <Sg id="stations" title="Stations, travel times and connections">
          <p className="text-base leading-7 text-muted-foreground">
            The minutes below are from TheBus's official timetable for a train leaving East Kapolei.
            A full end-to-end ride takes about 34 to 36 minutes. Westbound trips take about the same
            time.
          </p>
          <figure className="sg-map">
            <SkylineMap
              pins={PINS}
              title="Map of Skyline's line from East Kapolei to Kalihi with all 13 stations. The four areas of the line are numbered 1 to 4 from west to east: Kapolei and ʻEwa, Waipahu and Pearl Highlands, Pearl Harbor and Aloha Stadium, and the airport and town end."
              showAllStations
              labels={ENDS}
            />
            <figcaption className="sr-only">
              Skyline's 13 stations, west to east, in the four areas listed below.
            </figcaption>
          </figure>
          <p className="sr-only">Skyline stations, west to east (timetable, October 2026)</p>
          <ol className="grid gap-4">
            {AREAS.map((area) => {
              const withBuses = area.stations.filter((s) => s.buses);
              return (
                <li key={area.n} className="sg-card p-4 sm:p-5">
                  <h3 className="flex items-center gap-3 text-lg font-bold leading-tight">
                    <span className="sg-num" aria-hidden="true">
                      {area.n}
                    </span>
                    <span>{area.title}</span>
                  </h3>
                  <ul className="mt-3 grid text-base leading-6 text-muted-foreground">
                    {area.stations.map((s) => (
                      <li
                        key={s.id}
                        className="flex items-baseline gap-3 border-b border-border/50 py-2.5 last:border-0"
                      >
                        <span className="min-w-0 flex-1">
                          <Name s={s} />
                          {s.lot && (
                            <span className="sg-pill sg-pill--yes ml-2 !min-h-6 !px-2 !text-sm align-middle">
                              <CarFront className="mr-1 size-3.5" aria-hidden="true" />
                              Park-and-ride lot
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-right font-bold tabular-nums text-foreground">
                          {s.minutes === 0 ? "Start" : `${s.minutes} min`}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {withBuses.length > 0 && (
                    <details className="group mt-2 rounded-xl border border-border/60">
                      <summary className={SUMMARY}>
                        <span className="flex flex-1 items-center gap-2">
                          <Bus className="size-4 text-primary" aria-hidden="true" />
                          TheBus connections
                        </span>
                        <Chevron />
                      </summary>
                      <ul className="grid gap-2 px-4 pb-3 text-base leading-6 text-muted-foreground">
                        {withBuses.map((s) => (
                          <li key={s.id}>
                            <span className="font-semibold text-foreground">{s.english}:</span>{" "}
                            {s.buses}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </li>
              );
            })}
          </ol>
        </Sg>

        <Sg id="hours" title="Hours and how often trains come">
          <div className={CARD_TEXT}>
            <GuideList
              items={[
                <>
                  <B>Every day, same schedule:</B> weekdays, weekends and holidays.
                </>,
                <>
                  <B>First trains:</B> about 4:00 AM from both ends of the line.
                </>,
                <>
                  <B>Frequency:</B> every 10 minutes until about 8:30 PM, then every 15 minutes.
                </>,
                <>
                  <B>Last full-line trains:</B> about 10:00 PM from both East Kapolei and Kalihi
                  Transit Center, arriving at the other end about 10:35 PM.
                </>,
                <>
                  <B>Later trains run part of the line.</B> For example, the last westbound train
                  from Kalihi Transit Center, at about 10:20 PM, goes only as far as Pearlridge
                  (Kalauao). If you are going all the way west late at night, check your exact
                  train.
                </>,
              ]}
            />
          </div>
        </Sg>

        <Sg id="fares" title="Fares and HOLO cards">
          <div className={CARD_TEXT}>
            <p>
              Skyline and TheBus share one fare system. Pay with a HOLO card. The $3.00 adult fare
              is a 2-hour pass, so a transfer between TheBus and Skyline within that time is
              included. Once you have spent the daily cap, the rest of that day's rides are free.
            </p>
          </div>
          <GuideTable
            caption="HOLO fares listed on thebus.org (October 2026)"
            head={["Rider", "One ride (2-hour pass)", "Daily cap", "Monthly cap"]}
            rows={[
              ["Adult", "$3.00", "$7.50", "$90.00"],
              ["Youth (6 to 17, high school students up to 19)", "$1.50", "$3.75", "$45.00"],
              [
                "Senior (65+), Medicare card, disability card",
                "$1.25",
                "$3.00",
                "$20.00 (kamaʻāina)",
              ],
            ]}
          />
          <div className={CARD_TEXT}>
            <p>
              HOLO cards are sold at Skyline stations, Satellite City Halls (except Ala Moana), HOLO
              retail locations and the Transit Pass Office at Kalihi Transit Center on Middle
              Street. TheBus also takes cash ($3.25 for an adult, no transfers). Check{" "}
              <Ext href="https://www.thebus.org/Fare/FareAndPasses.asp">thebus.org fares</Ext>{" "}
              before you ride, since fares can change.
            </p>
          </div>
        </Sg>

        <Sg id="parking" title="Parking at stations">
          <div className={CARD_TEXT}>
            <p>
              The city lists free park-and-ride lots for transit riders at four stations: UH West
              Oʻahu (Keoneʻae, 304 stalls), Hoʻopili (Honouliuli, 344 stalls), Aloha Stadium
              (Hālawa, 590 stalls) and Kalihi Transit Center (Kahauiki, 95 stalls). Parking is
              limited to 24 hours.
            </p>
            <p>
              Hawaii News Now reported in May 2026 that the Keoneʻae lot fills by around 8 AM on
              weekdays. If you start later, consider Honouliuli, a bus to the station, or being
              dropped off. TheBus does not serve Honouliuli station, so you need to drive or be
              dropped off there.
            </p>
            <p>
              Entrances, train times from each lot and which lot suits where you start are in{" "}
              <Link
                to="/guides/skyline-park-and-ride"
                className="font-medium text-primary underline underline-offset-4"
              >
                Skyline station parking
              </Link>
              .
            </p>
          </div>
        </Sg>

        <Sg id="luggage" title="Luggage, bikes and boards">
          <ul className="grid gap-3">
            {[
              <>
                <B>Luggage:</B> one standard suitcase and one smaller carry-on bag per rider, kept
                in front of or next to you. Bags cannot block the aisle or take up seats.
              </>,
              <>
                <B>Bikes:</B> allowed on trains. Use the bike racks by the doors, and walk your bike
                inside stations and trains.
              </>,
              <>
                <B>Scooters and skateboards:</B> you cannot ride them in stations or on trains.
              </>,
            ].map((item, i) => (
              <li key={i} className="sg-card p-4 text-base leading-7 text-muted-foreground">
                {item}
              </li>
            ))}
          </ul>
          <p className="text-base leading-7 text-muted-foreground">
            Full rules are on the city's{" "}
            <Ext href="https://www.honolulu.gov/dts/skyline/rules-regulations-and-rider-tips/">
              Skyline rules page
            </Ext>
            .
          </p>
        </Sg>

        <Sg id="beyond" title="Getting past the end of the line">
          <p className="text-base leading-7 text-muted-foreground">
            Most trips into town finish on TheBus. Common connections in the current timetable:
          </p>
          <ul className="grid gap-3">
            {[
              <>
                <B>Downtown and UH Mānoa:</B> the A Line from Lagoon Drive (Ahua) runs along King
                Street through downtown to UH Mānoa, every 10 to 15 minutes on weekdays.
              </>,
              <>
                <B>Ala Moana and Waikīkī:</B> the W Line from the airport (Lelepaua) and Ahua runs
                to Ala Moana Center and Waikīkī.
              </>,
              <>
                <B>Kalihi and downtown:</B> Route 2 and others leave from Kalihi Transit Center
                (Kahauiki).
              </>,
            ].map((item, i) => (
              <li key={i} className="sg-card p-4 text-base leading-7 text-muted-foreground">
                {item}
              </li>
            ))}
          </ul>
          <p className="text-base leading-7 text-muted-foreground">
            Nalu plans the whole trip, train plus bus plus walking, and compares it with driving for
            the time you want to leave.
          </p>
        </Sg>
      </div>
    </GuideLayout>
  );
}

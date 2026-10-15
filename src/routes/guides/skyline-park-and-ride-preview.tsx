import { Link, createFileRoute } from "@tanstack/react-router";
import { Bus, CarFront, ChevronDown } from "lucide-react";
import { SkylineLineDiagram } from "@/components/guides/SkylineLineDiagram";
import {
  SkylineMap,
  type SkylineMapLabel,
  type SkylineMapPin,
} from "@/components/guides/SkylineMap";
import { GUIDES } from "@/components/guides/guides";
import { DOWNTOWN } from "@/components/guides/destinations";
import { TryTripPanel } from "@/components/guides/TryTripPanel";
import { guideHead, type GuideFaq } from "@/components/guides/guide-head";
import { B, Ext, GuideLayout } from "@/components/guides/GuideLayout";
import "@/components/guides/skyline-parking.css";

/*
 * PREVIEW of the redesigned /guides/skyline-park-and-ride (Josh approves on his
 * phone before it replaces the real page). noindex; canonical is the real page;
 * not in the sitemap and not linked. Same facts as the real page; sources are
 * listed there (City and County of Honolulu Skyline "Stations and Parking" page,
 * TheBus GTFS through Dec 5, 2026, Hawaii News Now May 8, 2026). Build-2 reuse:
 * SkylineMap (src/components/guides/SkylineMap.tsx).
 */
const META = GUIDES.parking;

const FAQS: GuideFaq[] = [
  {
    q: "Is parking free at Skyline stations?",
    a: "Yes. The city's Skyline park-and-ride lots are free for transit riders, including TheBus riders, with a 24-hour limit.",
  },
  {
    q: "Which Skyline stations have parking?",
    a: "Four: UH West Oʻahu (Keoneʻae), Hoʻopili (Honouliuli), Aloha Stadium (Hālawa) and Kalihi Transit Center (Kahauiki).",
  },
  {
    q: "How many stalls does each Skyline park-and-ride have?",
    a: "The city lists 304 stalls at Keoneʻae, 344 at Honouliuli, 590 at Hālawa and 95 at Kahauiki.",
  },
  {
    q: "Does the Keoneʻae park-and-ride fill up?",
    a: "Yes. Hawaii News Now reported in May 2026 that it fills by around 8 AM on weekdays. Honouliuli, the next station east, is the closest other lot, but TheBus does not serve it, so you need to drive or be dropped off there.",
  },
  {
    q: "Is there parking at the Middle Street (Kahauiki) station?",
    a: "Yes. Kalihi Transit Center (Kahauiki) has a 95-stall park-and-ride. Enter from Middle Street toward the Kalihi Transit Center.",
  },
];

export const Route = createFileRoute("/guides/skyline-park-and-ride-preview")({
  head: () => {
    const head = guideHead({ ...META, faqs: FAQS });
    return {
      ...head,
      meta: head.meta.map((m) =>
        "name" in m && m.name === "robots" ? { ...m, content: "noindex,nofollow" } : m,
      ),
    };
  },
  component: SkylineParkAndRidePreview,
});

type Lot = {
  n: string;
  english: string;
  hawaiian: string;
  stalls: number;
  bus: boolean;
  note?: string;
  entrance: string;
  id: string;
};

const LOTS: Lot[] = [
  {
    n: "1",
    english: "UH West Oʻahu",
    hawaiian: "Keoneʻae",
    stalls: 304,
    bus: true,
    note: "Source: Hawaii News Now, May 2026.",
    entrance: "from Hoʻomohala Avenue, off Kualakaʻi Parkway",
    id: "10046",
  },
  {
    n: "2",
    english: "Hoʻopili",
    hawaiian: "Honouliuli",
    stalls: 344,
    bus: false,
    entrance: "from Kamālie Mua Street, off Hoʻomohala Avenue",
    id: "10045",
  },
  {
    n: "3",
    english: "Aloha Stadium",
    hawaiian: "Hālawa",
    stalls: 590,
    bus: true,
    entrance: "from Salt Lake Boulevard",
    id: "10055",
  },
  {
    n: "4",
    english: "Kalihi Transit Center",
    hawaiian: "Kahauiki",
    stalls: 95,
    bus: true,
    entrance: "from Middle Street, toward the Kalihi Transit Center",
    id: "10030",
  },
];

const PINS: SkylineMapPin[] = [
  { id: "10046", mark: "1", dx: -7, dy: 5, anchor: "end" },
  { id: "10045", mark: "2", dx: 6, dy: -7, anchor: "start" },
  { id: "10055", mark: "3", dy: -8 },
  { id: "10030", mark: "4", dy: -8 },
];

const ENDS: SkylineMapLabel[] = [
  { id: "10047", text: "East Kapolei", dy: 12 },
  { id: "10030", text: "Kalihi", dy: 12 },
];

const WHICH: Array<{ n: string; from: string; text: React.ReactNode }> = [
  {
    n: "1·2",
    from: "From Kapolei, Makakilo or ʻEwa",
    text: "Keoneʻae and Honouliuli are 2 minutes apart on the train. Keoneʻae is the lot reported to fill on weekday mornings; Honouliuli has 40 more stalls but no TheBus service.",
  },
  {
    n: "3",
    from: "From ʻAiea, Salt Lake or Moanalua",
    text: "Hālawa is the largest lot, with 590 stalls, 12 minutes by train to Kahauiki.",
  },
  {
    n: "4",
    from: "Heading west from town (to the airport, Pearl Harbor or the Leeward side)",
    text: "Kahauiki is the only lot at the town end of the line, with 95 stalls.",
  },
  {
    n: "!",
    from: "If the lot is full",
    text: "A drop-off works at any station. TheBus stops at Keoneʻae, Hālawa and Kahauiki, but not Honouliuli.",
  },
];

const TIMES: Array<[string, string, string, string]> = [
  ["Keoneʻae", "26", "30", "32"],
  ["Honouliuli", "24", "28", "30"],
  ["Hālawa", "6", "10", "12"],
  ["Kahauiki", "6", "2 to 3", "—"],
];

function LotName({ lot }: { lot: Lot }) {
  return (
    <>
      <span className="font-semibold text-foreground">{lot.english}</span>{" "}
      <span className="text-sm font-normal text-muted-foreground">{lot.hawaiian}</span>
    </>
  );
}

function SkylineParkAndRidePreview() {
  return (
    <GuideLayout
      breadcrumb="Skyline station parking"
      title="Skyline station parking: the four park-and-ride lots"
      faqs={FAQS}
      related={["skyline", "kapolei", "ewa"]}
      intro={
        <>
          <p>
            Skyline has four free park-and-ride lots: UH West Oʻahu (Keoneʻae) and Hoʻopili
            (Honouliuli) on the Leeward side, Aloha Stadium (Hālawa), and Kalihi Transit Center
            (Kahauiki). They are free for anyone riding Skyline or TheBus, with a 24-hour limit.
          </p>
        </>
      }
    >
      <div className="nh sg grid grid-cols-[minmax(0,1fr)] gap-10">
        <TryTripPanel destination={DOWNTOWN} />

        <section aria-labelledby="lots" className="grid gap-4">
          <h2 id="lots" className="text-2xl font-bold">
            The four lots
          </h2>
          <figure className="sg-map">
            <SkylineMap
              pins={PINS}
              title="Map of Skyline's line from East Kapolei to Kalihi, with the four park-and-ride stations numbered 1 to 4 from west to east: UH West Oʻahu, Hoʻopili, Aloha Stadium and Kalihi Transit Center."
              showAllStations
              labels={ENDS}
            />
            <figcaption className="sr-only">
              The four free park-and-ride stations along Skyline, numbered west to east as in the
              list below.
            </figcaption>
          </figure>
          <ol className="grid gap-4 text-base leading-7 text-muted-foreground">
            {LOTS.map((lot) => (
              <li key={lot.id} className="sg-card p-4 sm:p-5">
                <h3 className="flex items-center gap-3 text-lg font-bold leading-tight">
                  <span className="sg-num" aria-hidden="true">
                    {lot.n}
                  </span>
                  <span>
                    <LotName lot={lot} />
                  </span>
                </h3>
                <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-2">
                  <p className="flex items-baseline gap-2">
                    <span className="sg-stalls">{lot.stalls}</span>
                    <span className="text-base font-semibold text-foreground">stalls</span>
                  </p>
                  <p className="flex flex-wrap gap-2">
                    <span className={lot.bus ? "sg-pill sg-pill--yes" : "sg-pill sg-pill--no"}>
                      <Bus className="mr-1.5 size-4" aria-hidden="true" />
                      TheBus stop: {lot.bus ? "Yes" : "No"}
                    </span>
                  </p>
                </div>
                {lot.note && (
                  <p className="mt-3">
                    <span className="sg-pill sg-pill--warn">Often full by 8 AM weekdays</span>{" "}
                    <span className="mt-1 block sm:mt-0 sm:inline">{lot.note}</span>
                  </p>
                )}
                <p className="mt-3 flex gap-2">
                  <CarFront className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>
                    <B>Drive in</B> {lot.entrance}.
                  </span>
                </p>
              </li>
            ))}
          </ol>
          <details className="sg-card group">
            <summary className="flex min-h-12 cursor-pointer list-none items-center px-4 text-base font-semibold text-foreground [&::-webkit-details-marker]:hidden">
              <span className="flex-1">All 13 stations on the line</span>
              <ChevronDown
                className="size-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
                aria-hidden="true"
              />
            </summary>
            <div className="px-3 pb-3">
              <SkylineLineDiagram mode="parking" />
            </div>
          </details>
          <p className="text-base leading-7 text-muted-foreground">
            No other station has a park-and-ride in the city's list, including Pearl Highlands
            (Waiawa) and the airport (Lelepaua). Step-by-step directions to each entrance are on the
            city's{" "}
            <Ext href="https://www.honolulu.gov/dts/skyline/stations-and-parking/">
              Stations and Parking page
            </Ext>
            .
          </p>
          <p className="sr-only">
            Lots are listed by the City and County of Honolulu (October 2026).
          </p>
        </section>

        <section aria-labelledby="which-lot" className="grid gap-4">
          <h2 id="which-lot" className="text-2xl font-bold">
            Which lot to use
          </h2>
          <ul className="grid gap-3">
            {WHICH.map((row) => (
              <li
                key={row.from}
                className="sg-card flex gap-3 p-4 text-base leading-7 text-muted-foreground"
              >
                <span className="sg-num mt-0.5" aria-hidden="true">
                  {row.n}
                </span>
                <p>
                  <B>{row.from}:</B> {row.text}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="train-times" className="grid gap-4">
          <h2 id="train-times" className="text-2xl font-bold">
            Train times from each lot
          </h2>
          <figure className="sg-card overflow-hidden">
            <figcaption className="px-4 pt-3 text-base font-semibold text-foreground">
              Minutes on the train to the airport (Lelepaua), Lagoon Drive (Ahua) and Kahauiki, from
              TheBus timetable through Dec 5, 2026
            </figcaption>
            <table className="sg-grid mt-2 w-full border-collapse text-left text-base">
              <thead>
                <tr className="border-b border-border text-sm text-muted-foreground">
                  <th scope="col" className="px-4 py-2 font-semibold">
                    From
                  </th>
                  <th scope="col" className="px-2 py-2 font-semibold">
                    Airport
                  </th>
                  <th scope="col" className="px-2 py-2 font-semibold">
                    Ahua
                  </th>
                  <th scope="col" className="px-2 py-2 font-semibold">
                    Kahauiki
                  </th>
                </tr>
              </thead>
              <tbody>
                {TIMES.map((row) => (
                  <tr key={row[0]} className="border-b border-border/60 last:border-0">
                    <th scope="row" className="px-4 py-3 font-semibold text-foreground">
                      {row[0]}
                    </th>
                    <td className="px-2 py-3 text-lg font-bold text-foreground">{row[1]}</td>
                    <td className="px-2 py-3 text-lg font-bold text-foreground">{row[2]}</td>
                    <td className="px-2 py-3 text-lg font-bold text-foreground">{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </figure>
          <p className="text-base leading-7 text-muted-foreground">
            Add your wait for the train: Skyline runs every 10 minutes until about 8:30 PM and every
            15 minutes after that. Skyline does not reach downtown yet, so a trip into town finishes
            on TheBus, for example from Ahua or Kahauiki. The{" "}
            <Link
              to="/guides/skyline-rail-guide"
              className="font-medium text-primary underline underline-offset-4"
            >
              Skyline rail guide
            </Link>{" "}
            has every station and its bus connections.
          </p>
        </section>

        <section
          aria-labelledby="park-or-drive"
          className="sg-card grid gap-3 p-5 text-base leading-7 text-muted-foreground sm:p-6"
        >
          <h2 id="park-or-drive" className="text-2xl font-bold text-foreground">
            Park and ride, or drive the whole way?
          </h2>
          <p>
            Parking at a station adds a train ride, and usually a bus at the other end. Whether that
            beats driving all the way depends on H-1 traffic when you leave and when you need to
            arrive.
          </p>
          <p>
            Nalu compares driving the whole way with taking Skyline and TheBus, including getting to
            the station, for your exact trip and the time you want to go.
          </p>
        </section>
      </div>
    </GuideLayout>
  );
}

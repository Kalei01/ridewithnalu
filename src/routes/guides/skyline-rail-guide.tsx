import { Link, createFileRoute } from "@tanstack/react-router";
import { SkylineLineDiagram } from "@/components/guides/SkylineLineDiagram";
import { GUIDES } from "@/components/guides/guides";
import { guideHead, type GuideFaq } from "@/components/guides/guide-head";
import { B, Ext, GuideLayout, GuideList, GuideSection, GuideTable } from "@/components/guides/GuideLayout";

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

export const Route = createFileRoute("/guides/skyline-rail-guide")({
  head: () => guideHead({ ...META, faqs: FAQS }),
  component: SkylineGuidePage,
});

// Minutes are from TheBus GTFS (eastbound trip from Kualakaʻi). Connections are
// TheBus routes with stops at or right beside each station.
const STATIONS: Array<[string, string, string, string]> = [
  ["East Kapolei (Kualakaʻi)", "0", "C, 44, 46, 47, 95, 416", ""],
  ["UH West Oʻahu (Keoneʻae)", "2", "C, 40, 44, 46, 47, 95, 99", "Park-and-ride"],
  ["Hoʻopili (Honouliuli)", "4", "", "Park-and-ride"],
  ["West Loch (Hōʻaeʻae)", "7", "44", ""],
  ["Waipahu Transit Center (Pouhala)", "10", "E, 40, 42, 43, 99", ""],
  ["Leeward Community College (Halaulani)", "13", "", ""],
  ["Pearl Highlands (Waiawa)", "14", "40, 42, 43, 51, 88A", ""],
  ["Pearlridge (Kalauao)", "18", "32, 40, 42, 51, 53", ""],
  ["Aloha Stadium (Hālawa)", "22", "1L, 32, 40, 42, 51", "Park-and-ride"],
  ["Joint Base Pearl Harbor–Hickam (Makalapa)", "24", "", ""],
  ["Daniel K. Inouye International Airport (Lelepaua)", "28", "W Line, 40, 42, 51", ""],
  ["Lagoon Drive (Ahua)", "32", "A Line, U Line, W Line, 40, 42, 51", ""],
  ["Kalihi Transit Center (Kahauiki)", "34", "1, 2, 52, C, 40, 42, 51 and others", "Park-and-ride"],
];

function SkylineGuidePage() {
  return (
    <GuideLayout
      breadcrumb="Skyline rail guide"
      title="Skyline rail guide: hours, stations and fares"
      faqs={FAQS}
      related={["parking", "airport", "kapolei"]}
      intro={
        <>
          <p>
            Skyline, Honolulu's rail line, runs every day from about 4:00 AM to 10:30 PM between
            East Kapolei (Kualakaʻi) and Kalihi Transit Center (Kahauiki), with 13 stations including
            the airport. A ride costs $3.00 with a HOLO card, the same as TheBus, and trains come every
            10 minutes for most of the day.
          </p>
          <p className="mt-4">
            This is the detailed version of our{" "}
            <Link to="/oahu-commute" className="font-medium text-primary underline underline-offset-4">
              Oʻahu commute guide
            </Link>
            , with every station, the minutes between them, fares, parking and what you can bring.
          </p>
        </>
      }
    >
      <GuideSection id="open-now" title="What is open now">
        <p>
          All 13 stations from East Kapolei (Kualakaʻi) to Kalihi Transit Center (Kahauiki) are open.
          The first 9 stations opened in June 2023. Joint Base Pearl Harbor–Hickam (Makalapa), the airport (Lelepaua), Lagoon Drive (Ahua) and Kalihi Transit Center (Kahauiki)
          opened on October 16, 2025.
        </p>
        <p>
          Skyline does not reach downtown Honolulu yet. The next section, from Kalihi to Civic Center
          station in Kakaʻako, has a scheduled opening of March 2031, and the Honolulu Star-Advertiser
          reported in March 2026 that a design delay could push that date back.
        </p>
      </GuideSection>

      <GuideSection id="stations" title="Stations, travel times and connections">
        <p>
          The minutes below are from TheBus's official timetable for a train leaving East Kapolei. A full
          end-to-end ride takes about 34 to 36 minutes. Westbound trips take about the same time.
        </p>
        <SkylineLineDiagram mode="line" />
        <GuideTable
          caption="Skyline stations, west to east (timetable, October 2026)"
          head={["Station", "Min. from East Kapolei", "TheBus connections"]}
          rows={STATIONS.map(([name, minutes, buses, parking]) => [
            name,
            minutes,
            [buses || "No bus connections listed", parking ? `${parking} lot` : ""].filter(Boolean).join(". "),
          ])}
        />
      </GuideSection>

      <GuideSection id="hours" title="Hours and how often trains come">
        <GuideList
          items={[
            <><B>Every day, same schedule:</B> weekdays, weekends and holidays.</>,
            <><B>First trains:</B> about 4:00 AM from both ends of the line.</>,
            <><B>Frequency:</B> every 10 minutes until about 8:30 PM, then every 15 minutes.</>,
            <><B>Last full-line trains:</B> about 10:00 PM from both East Kapolei and Kalihi Transit Center, arriving at the other end about 10:35 PM.</>,
            <><B>Later trains run part of the line.</B> For example, the last westbound train from Kalihi Transit Center, at about 10:20 PM, goes only as far as Pearlridge (Kalauao). If you are going all the way west late at night, check your exact train.</>,
          ]}
        />
      </GuideSection>

      <GuideSection id="fares" title="Fares and HOLO cards">
        <p>
          Skyline and TheBus share one fare system. Pay with a HOLO card. The $3.00 adult fare is a
          2-hour pass, so a transfer between TheBus and Skyline within that time is included. Once you
          have spent the daily cap, the rest of that day's rides are free.
        </p>
        <GuideTable
          caption="HOLO fares listed on thebus.org (October 2026)"
          head={["Rider", "One ride (2-hour pass)", "Daily cap", "Monthly cap"]}
          rows={[
            ["Adult", "$3.00", "$7.50", "$90.00"],
            ["Youth (6 to 17, high school students up to 19)", "$1.50", "$3.75", "$45.00"],
            ["Senior (65+), Medicare card, disability card", "$1.25", "$3.00", "$20.00 (kamaʻāina)"],
          ]}
        />
        <p>
          HOLO cards are sold at Skyline stations, Satellite City Halls (except Ala Moana), HOLO retail
          locations and the Transit Pass Office at Kalihi Transit Center on Middle Street. TheBus also
          takes cash ($3.25 for an adult, no transfers). Check{" "}
          <Ext href="https://www.thebus.org/Fare/FareAndPasses.asp">thebus.org fares</Ext> before you
          ride, since fares can change.
        </p>
      </GuideSection>

      <GuideSection id="parking" title="Parking at stations">
        <p>
          The city lists free park-and-ride lots for transit riders at four stations: UH West Oʻahu (Keoneʻae, 304 stalls), Hoʻopili (Honouliuli, 344 stalls), Aloha Stadium (Hālawa, 590 stalls) and Kalihi Transit Center (Kahauiki, 95 stalls). Parking is limited to 24
          hours.
        </p>
        <p>
          Hawaii News Now reported in May 2026 that the Keoneʻae lot fills by around 8 AM on
          weekdays. If you start later, consider Honouliuli, a bus to the station, or being dropped
          off. TheBus does not serve Honouliuli station, so you need to drive or be dropped off there.
        </p>
        <p>
          Entrances, train times from each lot and which lot suits where you start are in{" "}
          <Link to="/guides/skyline-park-and-ride" className="font-medium text-primary underline underline-offset-4">
            Skyline station parking
          </Link>
          .
        </p>
      </GuideSection>

      <GuideSection id="luggage" title="Luggage, bikes and boards">
        <GuideList
          items={[
            <><B>Luggage:</B> one standard suitcase and one smaller carry-on bag per rider, kept in front of or next to you. Bags cannot block the aisle or take up seats.</>,
            <><B>Bikes:</B> allowed on trains. Use the bike racks by the doors, and walk your bike inside stations and trains.</>,
            <><B>Scooters and skateboards:</B> you cannot ride them in stations or on trains.</>,
          ]}
        />
        <p>
          Full rules are on the city's{" "}
          <Ext href="https://www.honolulu.gov/dts/skyline/rules-regulations-and-rider-tips/">
            Skyline rules page
          </Ext>
          .
        </p>
      </GuideSection>

      <GuideSection id="beyond" title="Getting past the end of the line">
        <p>Most trips into town finish on TheBus. Common connections in the current timetable:</p>
        <GuideList
          items={[
            <><B>Downtown and UH Mānoa:</B> the A Line from Lagoon Drive (Ahua) runs along King Street through downtown to UH Mānoa, every 10 to 15 minutes on weekdays.</>,
            <><B>Ala Moana and Waikīkī:</B> the W Line from the airport (Lelepaua) and Ahua runs to Ala Moana Center and Waikīkī.</>,
            <><B>Kalihi and downtown:</B> Route 2 and others leave from Kalihi Transit Center (Kahauiki).</>,
          ]}
        />
        <p>
          Nalu plans the whole trip, train plus bus plus walking, and compares it with driving for the
          time you want to leave.
        </p>
      </GuideSection>
    </GuideLayout>
  );
}

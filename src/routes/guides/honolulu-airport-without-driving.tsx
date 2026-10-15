import { createFileRoute } from "@tanstack/react-router";
import { GUIDES } from "@/components/guides/guides";
import { HNL_AIRPORT } from "@/components/guides/destinations";
import { guideHead, type GuideFaq } from "@/components/guides/guide-head";
import { B, Ext, GuideLayout, GuideList, GuideSection } from "@/components/guides/GuideLayout";
import { DriveVsRailDiagram } from "@/components/guides/DriveVsRailDiagram";
import { GuideDetails, GuideMap, StatTiles } from "@/components/guides/GuideBlocks";

// Sources (checked October 2026): TheBus GTFS timetable valid Sept 28 to Dec 5, 2026
// (Skyline minutes, W Line times and frequency, which routes stop at the airport and
// when); HDOT news release on airport ground transportation changes, October 2025
// (station location, walkways, bus stop and rideshare pickup changes); thebus.org
// baggage notice effective October 16, 2025 and rules page; City and County of
// Honolulu Skyline rules (luggage); thebus.org fares.
const META = GUIDES.airport;

const STEPS = [
  "Get a HOLO card, sold at Skyline stations, or use one you already have.",
  "Ride Skyline to the airport station, Daniel K. Inouye International Airport (Lelepaua).",
  "Follow the walkway from the station to the Terminal 2 Parking Garage or the International Parking Garage, then to your terminal. Terminal 1 is a longer walk.",
  "Check in for your flight as usual.",
];

const FAQS: GuideFaq[] = [
  {
    q: "Does Skyline go to Honolulu airport?",
    a: "Yes. Skyline's airport station, Daniel K. Inouye International Airport (Lelepaua), serves HNL. It sits on the mountain side of Terminal 2, with walkways to the Terminal 2 and International parking garages. Terminal 1 is a longer walk.",
  },
  {
    q: "Can I bring a suitcase on TheBus or Skyline?",
    a: "Yes. Since October 16, 2025, TheBus has allowed one standard suitcase and one smaller carry-on bag on all routes under a temporary rule, and the city's Skyline rules allow the same. Keep bags in front of or next to you, out of the aisle and off the seats.",
  },
  {
    q: "How do I get from Waikīkī to the airport by bus?",
    a: "Take TheBus W Line, which runs between Waikīkī and the airport's Skyline station by way of Ala Moana Center and downtown. The timetable shows a ride of about 30 to 35 minutes, with buses about every 10 to 15 minutes on weekdays and every 15 minutes on weekends during the day.",
  },
  {
    q: "How early can I get to the airport without a car?",
    a: "Skyline's first trains reach the airport at about 4:00 AM, and the first W Line trips leave at about 4:15 AM. Overnight, a few Route 40 and 42 trips stop at the airport, and Route 40 has trips there until about 3:45 AM.",
  },
  {
    q: "Where is rideshare pickup at Honolulu airport?",
    a: "Since October 2025, rideshare pickup has been on the ground level. HDOT lists Terminal 1 pickup at the curb on the mountain side of Baggage Claim 6, and Terminal 2 pickup on the ground-level median across from Baggage Claims 19/20 and 31.",
  },
];

export const Route = createFileRoute("/guides/honolulu-airport-without-driving")({
  head: () =>
    guideHead({
      ...META,
      faqs: FAQS,
      howTo: { name: "Take Skyline to Honolulu airport (HNL)", steps: STEPS },
    }),
  component: AirportGuidePage,
});

function AirportGuidePage() {
  return (
    <GuideLayout
      destination={HNL_AIRPORT}
      showDiagram={false}
      strip={
        <StatTiles
          label="What to know"
          items={[
            { value: "$3.00", label: "Skyline or TheBus with a HOLO card" },
            {
              value: "10",
              unit: "min",
              label: "Between trains until about 8:30 PM",
              note: "Every 15 minutes after that.",
            },
          ]}
        />
      }
      take="Good news: Skyline stops at the airport. The airport station (Lelepaua) is on the mountain side of Terminal 2. From Waikīkī, TheBus W Line is scheduled at about 30 to 35 minutes. For very early flights, note that the first trains reach the airport at about 4:00 AM."
      breadcrumb="Airport without driving"
      title="Getting to Honolulu airport (HNL) without driving"
      faqs={FAQS}
      related={["skyline", "lateNight", "compare"]}
      intro={
        <p>
          You can reach Daniel K. Inouye International Airport (HNL) without a car on Skyline, which
          stops at the airport station (Lelepaua) beside Terminal 2, or on TheBus W Line from
          Waikīkī, Ala Moana and downtown. Both cost $3.00 with a HOLO card, and both currently
          allow one standard suitcase plus one smaller carry-on bag.
        </p>
      }
    >
      <GuideSection id="skyline" title="Skyline to the airport station (Lelepaua)">
        <p>
          The airport station (Lelepaua) is on the mountain (mauka) side of Terminal 2. According to
          HDOT, walkways connect it to the 4th floor of the Terminal 2 Parking Garage and the
          International Parking Garage. Terminal 2 is the short walk; Terminal 1 is farther, so
          allow extra time if you are flying from there.
        </p>
        <GuideMap
          pins={[{ id: "10032", mark: "1", dx: 0, dy: -8 }]}
          title="Map of Skyline's line with the airport station (Lelepaua) marked 1."
          caption="The airport station (Lelepaua) on Skyline's line."
          legend={["Daniel K. Inouye International Airport (Lelepaua)"]}
        />
        <p className="text-base font-semibold text-foreground">
          Scheduled Skyline ride to the airport (timetable, October 2026)
        </p>
        <StatTiles
          label="Minutes on the train to the airport"
          uniform
          items={[
            { prefix: "About", value: "28", unit: "min", label: "East Kapolei (Kualakaʻi)" },
            {
              prefix: "About",
              value: "18",
              unit: "min",
              label: "Waipahu Transit Center (Pouhala)",
            },
            { prefix: "About", value: "14", unit: "min", label: "Pearl Highlands (Waiawa)" },
            { prefix: "About", value: "10", unit: "min", label: "Pearlridge (Kalauao)" },
            { prefix: "About", value: "3", unit: "min", label: "Lagoon Drive (Ahua)" },
            { prefix: "About", value: "6", unit: "min", label: "Kalihi Transit Center (Kahauiki)" },
          ]}
        />
        <p>
          Trains run every day from about 4:00 AM, every 10 minutes until about 8:30 PM and every 15
          minutes after that. The last train that runs all the way to East Kapolei (Kualakaʻi)
          leaves the airport at about 10:05 PM, so check your exact train if you land late.
        </p>
      </GuideSection>

      <GuideSection id="howto" title="Step by step: Skyline to your flight">
        <ol className="grid list-decimal gap-2 pl-6">
          {STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </GuideSection>

      <GuideSection id="bus" title="TheBus to the airport">
        <GuideList
          items={[
            <>
              <B>W Line (Airport to Waikīkī):</B> limited stops between the airport's Skyline
              station and Waikīkī by way of Lagoon Drive (Ahua), downtown on Nimitz Highway, Ala
              Moana Center and Kūhiō Avenue. About 30 to 35 minutes in the timetable. Roughly every
              10 to 15 minutes on weekdays and every 15 minutes on weekends during the day, from
              about 4:15 AM. The last trips leave Waikīkī at about 12:30 AM and the airport at about
              1:30 AM.
            </>,
            <>
              <B>Routes 40, 42 and 51:</B> some late-night trips stop at the airport after Skyline
              closes. Route 40 has the latest, until about 3:45 AM.
            </>,
          ]}
        />
        <p>
          In October 2025, the old bus stops on the airport's upper-level roadway were replaced with
          a ground-level stop, and TheBus's timetable now lists airport buses at its Lelepaua
          Airport Station stop. Follow the airport's signs for TheBus.
        </p>
      </GuideSection>

      <GuideSection id="luggage" title="Luggage rules">
        <GuideList
          items={[
            <>
              <B>TheBus:</B> a temporary rule in effect since October 16, 2025 allows one standard
              suitcase and one smaller carry-on size bag on all routes. Bags must be kept in front
              of or next to you and cannot block the aisle, take up seats, or get in other riders'
              way.
            </>,
            <>
              <B>TheBus standing rule:</B> bags that fit on your lap or under your seat ride free,
              such as a briefcase up to 22 x 14 x 9 inches or a folded stroller.
            </>,
            <>
              <B>Skyline:</B> the city's rules allow one standard suitcase and one smaller carry-on
              bag, kept out of the aisle.
            </>,
          ]}
        />
        <p>
          Because the TheBus rule is labeled temporary, check{" "}
          <Ext href="https://www.thebus.org/howtoride/RulesReg.asp">TheBus rules</Ext> before a trip
          with large bags.
        </p>
      </GuideSection>

      <GuideSection id="other" title="Rideshare and pickups">
        <p>
          Since October 2025, rideshare pickups at HNL are on the ground level. HDOT lists the
          Terminal 1 pickup at the curb on the mountain side of Baggage Claim 6, and the Terminal 2
          pickups on the ground-level median across from Baggage Claims 19/20 and 31.
        </p>
        <p>
          Nalu compares driving, Skyline and TheBus for your trip to or from the airport and can
          hand you off to a rideshare app when that makes more sense, for example late at night.
        </p>
        <GuideDetails title="Driving or riding: how the two differ">
          <DriveVsRailDiagram />
        </GuideDetails>
      </GuideSection>
    </GuideLayout>
  );
}

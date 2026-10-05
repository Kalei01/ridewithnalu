import { Link, createFileRoute } from "@tanstack/react-router";
import { GUIDES } from "@/components/guides/guides";
import { guideHead, type GuideFaq } from "@/components/guides/guide-head";
import { B, Ext, GuideLayout, GuideList, GuideSection, GuideTable } from "@/components/guides/GuideLayout";

// Sources (checked October 5, 2026): City and County of Honolulu Skyline "Stations
// and Parking" page (the four park-and-ride lots, entrances, free for transit riders,
// 24-hour limit) and its station pages (stall counts, TheBus connections, including
// "TheBus does not have service to and from" Honouliuli station); TheBus GTFS
// timetable through Dec 5, 2026 (train minutes between stations; same in both service
// periods); Hawaii
// News Now, May 8, 2026 (Keoneʻae lot full by around 8 AM on weekdays).
const META = GUIDES.parking;

const FAQS: GuideFaq[] = [
  {
    q: "Is parking free at Skyline stations?",
    a: "Yes. The city's Skyline park-and-ride lots are free for transit riders, including TheBus riders, with a 24-hour limit.",
  },
  {
    q: "Which Skyline stations have parking?",
    a: "Four: Keoneʻae (UH West Oʻahu), Honouliuli (Hoʻopili), Hālawa (Aloha Stadium) and Kahauiki (Kalihi Transit Center).",
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
    a: "Yes. Kahauiki (Kalihi Transit Center) has a 95-stall park-and-ride. Enter from Middle Street toward the Kalihi Transit Center.",
  },
];

export const Route = createFileRoute("/guides/skyline-park-and-ride")({
  head: () => guideHead({ ...META, faqs: FAQS }),
  component: SkylineParkAndRidePage,
});

function SkylineParkAndRidePage() {
  return (
    <GuideLayout
      breadcrumb="Skyline station parking"
      title="Skyline station parking: the four park-and-ride lots"
      faqs={FAQS}
      related={["skyline", "kapolei", "ewa"]}
      intro={
        <>
          <p>
            Skyline has four free park-and-ride lots: Keoneʻae (UH West Oʻahu) and Honouliuli
            (Hoʻopili) on the Leeward side, Hālawa (Aloha Stadium), and Kahauiki (Kalihi Transit
            Center).
            They are free for anyone riding Skyline or TheBus, with a 24-hour limit.
          </p>
          <p className="mt-4">
            Hawaii News Now reported in May 2026 that the Keoneʻae lot is full by around 8 AM on
            weekdays.
          </p>
        </>
      }
    >
      <GuideSection id="lots" title="The four lots">
        <GuideTable
          caption="Skyline park-and-ride lots listed by the City and County of Honolulu (October 2026)"
          head={["Station", "Stalls", "TheBus stop?"]}
          rows={[
            ["Keoneʻae (UH West Oʻahu)", "304", "Yes"],
            ["Honouliuli (Hoʻopili)", "344", "No"],
            ["Hālawa (Aloha Stadium)", "590", "Yes"],
            ["Kahauiki (Kalihi Transit Center)", "95", "Yes"],
          ]}
        />
        <p>Where to drive in:</p>
        <GuideList
          items={[
            <><B>Keoneʻae:</B> from Hoʻomohala Avenue, off Kualakaʻi Parkway.</>,
            <><B>Honouliuli:</B> from Kamālie Mua Street, off Hoʻomohala Avenue.</>,
            <><B>Hālawa:</B> from Salt Lake Boulevard.</>,
            <><B>Kahauiki:</B> from Middle Street, toward the Kalihi Transit Center.</>,
          ]}
        />
        <p>
          No other station has a park-and-ride in the city's list, including Waiawa (Pearl
          Highlands) and Lelepaua (airport). Step-by-step directions to each entrance are on the
          city's{" "}
          <Ext href="https://www.honolulu.gov/dts/skyline/stations-and-parking/">Stations and Parking page</Ext>.
        </p>
      </GuideSection>

      <GuideSection id="train-times" title="Train times from each lot">
        <GuideTable
          caption="Minutes on the train to Lelepaua (airport), Āhua (Lagoon Drive) and Kahauiki, from TheBus timetable through Dec 5, 2026"
          head={["From", "Airport", "Āhua", "Kahauiki"]}
          rows={[
            ["Keoneʻae", "26", "30", "32"],
            ["Honouliuli", "24", "28", "30"],
            ["Hālawa", "6", "10", "12"],
            ["Kahauiki", "6", "2 to 3", "—"],
          ]}
        />
        <p>
          Add your wait for the train: Skyline runs every 10 minutes until about 8:30 PM and every 15
          minutes after that. Skyline does not reach downtown yet, so a trip into town finishes on
          TheBus, for example from Āhua or Kahauiki. The{" "}
          <Link to="/guides/skyline-rail-guide" className="font-medium text-primary underline underline-offset-4">
            Skyline rail guide
          </Link>{" "}
          has every station and its bus connections.
        </p>
      </GuideSection>

      <GuideSection id="which-lot" title="Which lot to use">
        <GuideList
          items={[
            <><B>From Kapolei, Makakilo or ʻEwa:</B> Keoneʻae and Honouliuli are 2 minutes apart on the train. Keoneʻae is the lot reported to fill on weekday mornings; Honouliuli has 40 more stalls but no TheBus service.</>,
            <><B>From ʻAiea, Salt Lake or Moanalua:</B> Hālawa is the largest lot, with 590 stalls, 12 minutes by train to Kahauiki.</>,
            <><B>Heading west from town</B> (to the airport, Pearl Harbor or the Leeward side): Kahauiki is the only lot at the town end of the line, with 95 stalls.</>,
            <><B>If the lot is full:</B> a drop-off works at any station. TheBus stops at Keoneʻae, Hālawa and Kahauiki, but not Honouliuli.</>,
          ]}
        />
      </GuideSection>

      <GuideSection id="park-or-drive" title="Park and ride, or drive the whole way?">
        <p>
          Parking at a station adds a train ride, and usually a bus at the other end. Whether that
          beats driving all the way depends on H-1 traffic when you leave and when you need to arrive.
        </p>
        <p>
          Nalu compares driving the whole way with taking Skyline and TheBus, including getting to the
          station, for your exact trip and the time you want to go.
        </p>
      </GuideSection>
    </GuideLayout>
  );
}

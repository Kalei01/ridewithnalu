import { createFileRoute } from "@tanstack/react-router";
import { GUIDES } from "@/components/guides/guides";
import { DOWNTOWN } from "@/components/guides/destinations";
import { guideHead, type GuideFaq } from "@/components/guides/guide-head";
import { B, Ext, GuideLayout, GuideList, GuideSection } from "@/components/guides/GuideLayout";

// Sources (checked October 2026): TheBus GTFS timetable valid Sept 28 to Dec 5, 2026
// (Skyline and bus scheduled times, routes at each station, express trips); City and
// County of Honolulu Skyline stations and parking page; Hawaii News Now, May 8, 2026
// (Keoneʻae park-and-ride filling by 8 AM); thebus.org fares and route list.
const META = GUIDES.kapolei;

const FAQS: GuideFaq[] = [
  {
    q: "Does Skyline go from Kapolei to downtown Honolulu?",
    a: "Not all the way. Skyline runs from Kualakaʻi (East Kapolei) to Kahauiki (Kalihi Transit Center). For downtown, most riders transfer to TheBus, for example the A Line at Āhua (Lagoon Drive) station, which runs along King Street through downtown.",
  },
  {
    q: "How long is the Skyline ride from East Kapolei?",
    a: "In TheBus's timetable, the train from Kualakaʻi (East Kapolei) takes about 32 minutes to Āhua (Lagoon Drive) and 34 minutes to Kahauiki (Kalihi Transit Center). The A Line from Āhua to King and Bishop streets downtown is scheduled at about 21 to 28 minutes in the morning, plus your wait for the bus.",
  },
  {
    q: "Where can I park for Skyline in Kapolei?",
    a: "The city's free park-and-ride lots on the Kapolei side are at Keoneʻae (UH West Oʻahu) and Honouliuli (Hoʻopili) stations. Hawaii News Now reported in May 2026 that the Keoneʻae lot fills by about 8 AM on weekdays.",
  },
  {
    q: "Is there a bus from Kapolei to downtown without changing?",
    a: "Yes. The CountryExpress C runs from Kapolei through downtown on King Street to Ala Moana, about every 30 minutes on weekdays. There are also a few weekday express trips, such as Routes 92 (Makakilo) and 94 (Villages of Kapolei), early in the morning.",
  },
  {
    q: "Is it faster to drive or take Skyline from Kapolei?",
    a: "It depends on H-1 traffic at the moment you leave. Skyline's train times do not change with traffic, while driving and the bus legs do. Nalu checks live traffic and the timetable for your exact trip and tells you which is faster right now.",
  },
];

export const Route = createFileRoute("/guides/kapolei-to-downtown")({
  head: () => guideHead({ ...META, faqs: FAQS }),
  component: KapoleiGuidePage,
});

function KapoleiGuidePage() {
  return (
    <GuideLayout
      destination={DOWNTOWN}
      take="Skyline gets you most of the way from East Kapolei, but it stops short of downtown, so you add a bus. On a clear H-1 morning, driving is hard to beat. On a slow one, the train leg keeps its schedule while H-1 does not. That is why I check both for your exact trip instead of picking a side for you."
      breadcrumb="Kapolei to downtown"
      title="Kapolei to downtown Honolulu: drive, or Skyline and the bus?"
      faqs={FAQS}
      related={["skyline", "parking", "ewa"]}
      intro={
        <p>
          From Kapolei or East Kapolei you can drive H-1 into town, or take Skyline from Kualakaʻi
          (East Kapolei) or Keoneʻae (UH West Oʻahu) and finish on TheBus, because Skyline does not
          reach downtown yet. Which is faster depends on H-1 traffic when you leave, so Nalu compares
          both for your exact trip.
        </p>
      }
    >
      <GuideSection id="drive" title="Kapolei to Honolulu drive time on H-1">
        <p>
          Driving is usually the simplest option outside rush hour. On weekday mornings, eastbound H-1
          traffic from the Leeward side can turn a short drive into a long one, and how long it takes
          changes from day to day with crashes, roadwork and weather. Parking downtown adds time and
          cost at the other end.
        </p>
        <p>
          Nalu uses TomTom live traffic for the drive time and shows planned HDOT lane closures on
          your route, so you see today's number rather than a typical one.
        </p>
      </GuideSection>

      <GuideSection id="rail" title="Kapolei to Honolulu by train and bus">
        <p>Scheduled times from TheBus's official timetable (October 2026):</p>
        <GuideList
          items={[
            <><B>Train:</B> Kualakaʻi (East Kapolei) to Āhua (Lagoon Drive) about 32 minutes; to Kahauiki (Kalihi Transit Center) about 34 minutes. From Keoneʻae, take off about 2 minutes.</>,
            <><B>A Line from Āhua:</B> to King and Bishop streets downtown about 21 to 28 minutes in the morning, about every 10 to 15 minutes on weekdays.</>,
            <><B>W Line from Āhua:</B> to Nimitz Highway at Bishop Street about 14 minutes, then on to Ala Moana and Waikīkī.</>,
            <><B>Route 2 from Kahauiki:</B> to Bishop Street downtown about 21 to 29 minutes in the morning.</>,
          ]}
        />
        <p>
          Added up, that is about 55 to 60 minutes on board from East Kapolei to downtown, plus the
          wait for your bus and the walk at each end. Trains come every 10 minutes for most of the day,
          and the train part of the trip does not slow down in traffic.
        </p>
        <p>
          A single $3.00 HOLO fare covers the train and the bus, because it works as a 2-hour pass.
        </p>
      </GuideSection>

      <GuideSection id="station" title="Getting to the station">
        <GuideList
          items={[
            <><B>Park-and-ride:</B> free for transit riders at Keoneʻae (UH West Oʻahu) and Honouliuli (Hoʻopili), with a 24-hour limit. The Keoneʻae lot has been full by about 8 AM on weekdays.</>,
            <><B>By bus to Kualakaʻi:</B> Routes 44, 46, 47, 95, 416 and the CountryExpress C stop at or beside the station.</>,
            <><B>By bus to Keoneʻae:</B> Routes 40, 44, 46, 47, 95, 99, 416, 461 and the C stop at or beside the station.</>,
            <><B>Drop-off:</B> being dropped off avoids the parking question entirely.</>,
          ]}
        />
      </GuideSection>

      <GuideSection id="bus" title="Buses that go straight to town">
        <GuideList
          items={[
            <><B>CountryExpress C:</B> from Kapolei through downtown (King Street) to Ala Moana, about every 30 minutes. From Kualakaʻi Parkway it is scheduled at about 40 to 45 minutes to King and Alakea streets in the morning.</>,
            <><B>Weekday express routes:</B> Routes 92 (Makakilo) and 94 (Villages of Kapolei) run a few early-morning trips to downtown and return in the afternoon. They do not run on weekends.</>,
          ]}
        />
        <p>
          Express trip times change with each timetable update. Check{" "}
          <Ext href="https://www.thebus.org/">thebus.org</Ext> for the current schedule.
        </p>
      </GuideSection>

      <GuideSection id="choose" title="Drive or train? How to choose your commute">
        <p>
          A rule of thumb: compare your drive, including parking, with the train trip's 55 to 60
          minutes on board plus your wait for the bus and the walk at each end. The train leg's
          scheduled time does not change with traffic, so the longer H-1 is running that day, the
          better the train looks.
        </p>
        <p>
          The honest answer is that it changes. A clear H-1 favors driving. A slow morning, a crash or
          a lane closure favors the train, especially if you live near a station. Nalu checks both for
          your exact start and end points, including the walk, the wait and the transfer, and tells you
          which is faster right now and when to leave. You can also plan backward with "Arrive by" or
          set a leave alert for your regular commute.
        </p>
      </GuideSection>
    </GuideLayout>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { GUIDES } from "@/components/guides/guides";
import { DOWNTOWN } from "@/components/guides/destinations";
import { guideHead, type GuideFaq } from "@/components/guides/guide-head";
import { B, Ext, GuideLayout, GuideList, GuideSection, GuideTable } from "@/components/guides/GuideLayout";

// Sources (checked October 2026): TheBus GTFS timetable valid Sept 28 to Dec 5, 2026
// (Routes 51 and 52 times and frequency, weekday-only express routes, stops near
// Skyline stations, Skyline minutes); thebus.org route list and August 23, 2026
// service changes (Pearl Harbor express reroute); City and County of Honolulu Skyline
// stations and parking page (park-and-ride locations).
const META = GUIDES.mililani;

const FAQS: GuideFaq[] = [
  {
    q: "Is there a Skyline station in Mililani?",
    a: "No. The nearest stations are Waiawa (Pearl Highlands) and Kalauao (Pearlridge). Route 51 from Mililani Transit Center stops near Waiawa station, about 21 to 24 minutes away in the timetable.",
  },
  {
    q: "Which bus goes from Mililani to downtown Honolulu?",
    a: "Route 52 is the more direct all-day bus, scheduled at about 47 to 56 minutes from Mililani Transit Center to King and Alakea streets on weekday mornings. Route 51 also goes downtown but takes longer. On weekdays, express Routes 84, 84A, 98 and 98A make a few morning trips to downtown and return in the afternoon.",
  },
  {
    q: "Do the Mililani express buses run on weekends?",
    a: "No. Routes 84, 84A, 98, 98A and the PH2 Pearl Harbor express run on weekdays only. Routes 51 and 52 run every day.",
  },
  {
    q: "Where can I park for Skyline from Mililani?",
    a: "The city's free park-and-ride lots are at Keoneʻae (UH West Oʻahu), Honouliuli (Hoʻopili) and Hālawa (Aloha Stadium). There is no park-and-ride at Waiawa (Pearl Highlands), so from Mililani a bus or a drop-off to Waiawa is usually simpler.",
  },
];

export const Route = createFileRoute("/guides/mililani-to-town")({
  head: () => guideHead({ ...META, faqs: FAQS }),
  component: MililaniGuidePage,
});

function MililaniGuidePage() {
  return (
    <GuideLayout
      destination={DOWNTOWN}
      breadcrumb="Mililani to town"
      title="Mililani and Central Oʻahu to town: bus, rail or drive"
      faqs={FAQS}
      related={["kapolei", "skyline", "airport"]}
      intro={
        <p>
          From Mililani, you can drive H-2 and H-1 into town, ride Route 52 or Route 51 from Mililani
          Transit Center, or catch a weekday express bus such as the 84, 84A or 98. Skyline has no
          Mililani station, so rail trips start with a bus or a drop-off at Waiawa (Pearl Highlands).
        </p>
      }
    >
      <GuideSection id="bus" title="Buses from Mililani to downtown">
        <p>
          Scheduled times are from TheBus's official timetable. They do not include waiting, and traffic
          can change them.
        </p>
        <GuideTable
          caption="Mililani to downtown by bus (timetable, October 2026)"
          head={["Route", "When it runs", "Scheduled ride"]}
          rows={[
            ["52 Honolulu–Mililani–Haleʻiwa", "Every day; about every 30 minutes on weekdays, about every 40 minutes on Sundays", "About 47 to 56 minutes from Mililani Transit Center to King and Alakea streets, weekday mornings"],
            ["51 Honolulu–Wahiawa", "Every day, into the night", "About 1 hr 10 min to 1 hr 20 min to downtown; stops near Waiawa (Pearl Highlands) station on the way"],
            ["84, 84A, 98, 98A express", "Weekdays only; a few early-morning trips to downtown, afternoon trips back", "About 55 to 65 minutes end to end"],
          ]}
        />
        <p>
          Also on weekdays: Route 99 links Wahiawa, Mililani, Waipahu and Kapolei, and the PH2 express
          runs between Mililani and Pearl Harbor. Since August 23, 2026, the Pearl Harbor express routes
          use the Makalapa Gate because the Hālawa Gate closed.
        </p>
      </GuideSection>

      <GuideSection id="rail" title="Using Skyline from Central Oʻahu">
        <GuideList
          items={[
            <><B>Waiawa (Pearl Highlands):</B> Route 51 from Mililani Transit Center stops near the station, about 21 to 24 minutes away. There is no park-and-ride here.</>,
            <><B>From Waiawa by train:</B> about 14 minutes to the airport, 18 minutes to Āhua (Lagoon Drive) and 20 minutes to Kahauiki (Kalihi Transit Center).</>,
            <><B>Into downtown:</B> transfer at Āhua to the A Line along King Street, or at Kahauiki to Route 2 and others.</>,
          ]}
        />
        <p>
          Rail tends to help most when you are going somewhere along the line, such as Pearlridge, the
          airport or Kalihi. For downtown, compare it with Route 52 or an express bus.
        </p>
      </GuideSection>

      <GuideSection id="drive" title="Driving H-2 and H-1">
        <p>
          Driving from Mililani means H-2 south and then H-1 east. Outside rush hour it is usually the
          quickest way into town. On weekday mornings traffic toward town can be heavy, and the delay
          changes from day to day.
        </p>
        <p>
          Nalu uses TomTom live traffic for the drive and shows planned HDOT lane closures on your route,
          then compares that with the bus and rail options for the same trip.
        </p>
      </GuideSection>

      <GuideSection id="choose" title="Choosing on a given day">
        <p>
          If an express bus fits your hours, it avoids parking downtown. If not, Route 52 and driving are
          the main choices for downtown, and Route 51 plus Skyline is worth comparing for trips along the
          rail line. Nalu checks them all for your exact trip and tells you which is faster right now and
          when to leave. Current timetables are on <Ext href="https://www.thebus.org/">thebus.org</Ext>.
        </p>
      </GuideSection>
    </GuideLayout>
  );
}

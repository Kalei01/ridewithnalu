import { createFileRoute } from "@tanstack/react-router";
import { GUIDES } from "@/components/guides/guides";
import { DOWNTOWN } from "@/components/guides/destinations";
import { guideHead, type GuideFaq } from "@/components/guides/guide-head";
import { B, Ext, GuideLayout, GuideList, GuideSection } from "@/components/guides/GuideLayout";
import { GuideMap, OptionCards, StatTiles } from "@/components/guides/GuideBlocks";
import type { SkylineMapPin } from "@/components/guides/SkylineMap";

// Sources (checked October 2026): TheBus GTFS timetable valid Sept 28 to Dec 5, 2026
// (routes serving Fort Weaver Road, scheduled times, frequencies, weekday-only express
// service, Skyline minutes); thebus.org route list and August 23, 2026 service change
// notices; thebus.org fares.
const META = GUIDES.ewa;

const FAQS: GuideFaq[] = [
  {
    q: "What is the fastest bus from ʻEwa Beach to downtown Honolulu?",
    a: "On weekday mornings, the 91 ʻEwa Beach Express and the CountryExpress E are the quickest direct buses in TheBus's timetable, scheduled at roughly 1 hr 5 min to 1 hr 20 min from Fort Weaver Road to downtown. Route 42 also goes downtown but makes many more stops and takes longer.",
  },
  {
    q: "Is there a Skyline station in ʻEwa Beach?",
    a: "No. The closest stations are UH West Oʻahu (Keoneʻae), West Loch (Hōʻaeʻae) and Waipahu Transit Center (Pouhala). Routes 47 and 44 connect ʻEwa with UH West Oʻahu, Route 44 also serves West Loch, and Route 42 stops at Waipahu Transit Center.",
  },
  {
    q: "Do the ʻEwa Beach express buses run on weekends?",
    a: "No. The 91 and 91A express routes run on weekdays only, with trips toward downtown in the early morning and back in the afternoon. The CountryExpress E and Route 42 run every day.",
  },
  {
    q: "Is there a late bus to ʻEwa Beach?",
    a: "Route 42 runs late. In the current timetable its last trip toward ʻEwa Beach leaves Waikīkī at about 1:20 AM, and service starts again around 4 AM. Skyline's last trains run at about 10:30 PM.",
  },
];

export const Route = createFileRoute("/guides/ewa-beach-to-downtown")({
  head: () => guideHead({ ...META, faqs: FAQS }),
  component: EwaGuidePage,
});

const PINS: SkylineMapPin[] = [
  { id: "10046", mark: "1", dx: -8, dy: 4, anchor: "end" },
  { id: "10044", mark: "2", dx: 2, dy: 14 },
  { id: "10043", mark: "3", dx: 0, dy: -8 },
];

function EwaGuidePage() {
  return (
    <GuideLayout
      destination={DOWNTOWN}
      strip={
        <StatTiles
          label="What to know"
          items={[
            {
              prefix: "About",
              value: "43",
              unit: "min",
              label: "Route 47 to UH West Oʻahu (Keoneʻae)",
              note: "The bus leg only, from Fort Weaver Road; then Skyline. The train from there to Lagoon Drive (Ahua) is about 30 minutes.",
            },
            {
              value: "$3.00",
              label: "One HOLO fare covers the bus and the train",
              note: "It works as a 2-hour pass.",
            },
          ]}
        />
      }
      take="There is no station in ʻEwa Beach itself. The 91 and the CountryExpress E are the direct buses, scheduled at roughly 1 hr to 1 hr 20 min on weekday mornings. If you would rather ride the train, Routes 47 and 44 connect ʻEwa with UH West Oʻahu (Keoneʻae). I compare all of it against H-1 for your exact trip."
      breadcrumb="ʻEwa Beach to downtown"
      title="ʻEwa Beach to downtown Honolulu: bus, rail or drive"
      faqs={FAQS}
      related={["kapolei", "skyline", "lateNight"]}
      intro={
        <p>
          From ʻEwa Beach, the direct buses into downtown Honolulu are the CountryExpress E, the
          weekday 91 and 91A express routes, and Route 42, or you can take a bus to Skyline at UH
          West Oʻahu, West Loch or Waipahu Transit Center. Driving means Fort Weaver Road and then
          H-1, where morning traffic varies from day to day, so Nalu compares the options live for
          your trip.
        </p>
      }
    >
      <GuideSection id="direct" title="Direct buses to downtown">
        <p>
          Scheduled times below are from TheBus's official timetable for weekday mornings, from Fort
          Weaver Road near Kuhina Street. They do not include waiting, and traffic can change them.
        </p>
        <p className="sr-only">ʻEwa Beach to downtown by bus (timetable, October 2026)</p>
        <OptionCards
          options={[
            {
              title: "91 ʻEwa Beach Express",
              big: "1 hr 5 min to 1 hr 20 min",
              detail: "Weekdays, morning trips about 4:20 to 7:10 AM; afternoon return.",
            },
            {
              title: "91A ʻEwa Gentry Express",
              big: "Check the timetable",
              detail: "Weekdays, a few early-morning trips; afternoon return.",
            },
            {
              title: "CountryExpress E",
              big: "1 hr to 1 hr 20 min",
              detail: "Every day; about every 30 minutes on weekdays, about hourly on Sundays.",
            },
            {
              title: "Route 42",
              big: "1 hr 40 min to 2 hr 10 min",
              detail: "Every day, into the night.",
            },
          ]}
        />
        <p>
          The E continues to Ala Moana and Waikīkī. Route 42 also reaches Waikīkī, and some of its
          trips stop at the airport.
        </p>
      </GuideSection>

      <GuideSection id="rail" title="ʻEwa Beach to Honolulu by train: bus to Skyline">
        <GuideMap
          pins={PINS}
          title="Map of Skyline's line with UH West Oʻahu (Keoneʻae), West Loch (Hōʻaeʻae) and Waipahu Transit Center (Pouhala) marked 1 to 3: the three stations a short bus ride from ʻEwa Beach."
          caption="The three Skyline stations reached by bus from ʻEwa Beach."
          legend={[
            "UH West Oʻahu (Keoneʻae)",
            "West Loch (Hōʻaeʻae)",
            "Waipahu Transit Center (Pouhala)",
          ]}
        />
        <p>ʻEwa Beach has no Skyline station, but three are a short bus ride away:</p>
        <GuideList
          items={[
            <>
              <B>Route 47 to UH West Oʻahu (Keoneʻae):</B> about 43 minutes from Fort Weaver Road
              near ʻEwa Beach Park. The train from UH West Oʻahu to Lagoon Drive (Ahua) is about 30
              minutes.
            </>,
            <>
              <B>Route 44</B> runs between UH West Oʻahu and West Loch (Hōʻaeʻae) stations by way of
              ʻEwa. The train from West Loch to Lagoon Drive is about 25 minutes.
            </>,
            <>
              <B>Route 42 to Waipahu Transit Center (Pouhala):</B> about 35 to 60 minutes from ʻEwa
              Beach depending on the time of day. The train from Waipahu Transit Center to Lagoon
              Drive is about 22 minutes.
            </>,
          ]}
        />
        <p>
          From Lagoon Drive, the A Line runs along King Street through downtown. One $3.00 HOLO fare
          covers the bus and the train, since it works as a 2-hour pass. Route 41 also links ʻEwa
          Beach with Kapolei Transit Center in about half an hour.
        </p>
      </GuideSection>

      <GuideSection id="drive" title="ʻEwa Beach to Honolulu drive time">
        <p>
          Most ʻEwa Beach drives start on Fort Weaver Road before joining H-1 eastbound. Both can be
          slow on weekday mornings, and the time changes with crashes, roadwork and weather. Nalu
          uses TomTom live traffic for the drive and flags planned HDOT lane closures on your route.
        </p>
      </GuideSection>

      <GuideSection id="choose" title="Drive, bus or train? How to choose your commute">
        <p>
          If you work near downtown and can catch a weekday-morning 91 or E (scheduled at roughly 1
          hr to 1 hr 20 min from Fort Weaver Road, not counting your wait), the bus spares you the
          drive and parking. If you are going somewhere along the rail line, such as Pearlridge, the
          airport or Kalihi, a bus to Skyline is often more direct. Nalu compares the drive with
          every bus and bus-plus-rail combination for your exact trip and tells you which is faster
          right now.
        </p>
        <p>
          Timetables change a few times a year; the latest changes took effect on August 23, 2026.
          Check <Ext href="https://www.thebus.org/">thebus.org</Ext> for current schedules.
        </p>
      </GuideSection>
    </GuideLayout>
  );
}

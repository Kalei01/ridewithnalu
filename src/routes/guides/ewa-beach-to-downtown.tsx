import { createFileRoute } from "@tanstack/react-router";
import { GUIDES } from "@/components/guides/guides";
import { guideHead, type GuideFaq } from "@/components/guides/guide-head";
import { B, Ext, GuideLayout, GuideList, GuideSection, GuideTable } from "@/components/guides/GuideLayout";

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
    a: "No. The closest stations are Keoneʻae (UH West Oʻahu), Hoʻaeʻae (West Loch) and Pouhala (Waipahu Transit Center). Routes 47 and 44 connect ʻEwa with Keoneʻae, Route 44 also serves Hoʻaeʻae, and Route 42 stops at Pouhala.",
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

function EwaGuidePage() {
  return (
    <GuideLayout
      breadcrumb="ʻEwa Beach to downtown"
      title="ʻEwa Beach to downtown Honolulu: bus, rail or drive"
      faqs={FAQS}
      related={["kapolei", "skyline", "lateNight"]}
      intro={
        <p>
          From ʻEwa Beach, the direct buses into downtown Honolulu are the CountryExpress E, the weekday
          91 and 91A express routes, and Route 42, or you can take a bus to Skyline at Keoneʻae,
          Hoʻaeʻae or Pouhala. Driving means Fort Weaver Road and then H-1, where morning traffic varies
          from day to day, so Nalu compares the options live for your trip.
        </p>
      }
    >
      <GuideSection id="direct" title="Direct buses to downtown">
        <p>
          Scheduled times below are from TheBus's official timetable for weekday mornings, from Fort
          Weaver Road near Kuhina Street. They do not include waiting, and traffic can change them.
        </p>
        <GuideTable
          caption="ʻEwa Beach to downtown by bus (timetable, October 2026)"
          head={["Route", "When it runs", "Scheduled ride to downtown"]}
          rows={[
            ["91 ʻEwa Beach Express", "Weekdays, morning trips about 4:20 to 7:10 AM; afternoon return", "About 1 hr 5 min to 1 hr 20 min"],
            ["91A ʻEwa Gentry Express", "Weekdays, a few early-morning trips; afternoon return", "Check the timetable"],
            ["CountryExpress E", "Every day; about every 30 minutes on weekdays, about hourly on Sundays", "About 1 hr to 1 hr 20 min"],
            ["Route 42", "Every day, into the night", "About 1 hr 40 min to 2 hr 10 min"],
          ]}
        />
        <p>
          The E continues to Ala Moana and Waikīkī. Route 42 also reaches Waikīkī, and some of its trips
          stop at the airport.
        </p>
      </GuideSection>

      <GuideSection id="rail" title="Bus to Skyline">
        <p>ʻEwa Beach has no Skyline station, but three are a short bus ride away:</p>
        <GuideList
          items={[
            <><B>Route 47 to Keoneʻae (UH West Oʻahu):</B> about 43 minutes from Fort Weaver Road near ʻEwa Beach Park. The train from Keoneʻae to Āhua (Lagoon Drive) is about 30 minutes.</>,
            <><B>Route 44</B> runs between Keoneʻae and Hoʻaeʻae (West Loch) stations by way of ʻEwa. The train from Hoʻaeʻae to Āhua is about 25 minutes.</>,
            <><B>Route 42 to Pouhala (Waipahu Transit Center):</B> about 35 to 60 minutes from ʻEwa Beach depending on the time of day. The train from Pouhala to Āhua is about 22 minutes.</>,
          ]}
        />
        <p>
          From Āhua, the A Line runs along King Street through downtown. One $3.00 HOLO fare covers the
          bus and the train, since it works as a 2-hour pass. Route 41 also links ʻEwa Beach with Kapolei
          Transit Center in about half an hour.
        </p>
      </GuideSection>

      <GuideSection id="drive" title="Driving">
        <p>
          Most ʻEwa Beach drives start on Fort Weaver Road before joining H-1 eastbound. Both can be slow
          on weekday mornings, and the time changes with crashes, roadwork and weather. Nalu uses
          TomTom live traffic for the drive and flags planned HDOT lane closures on your route.
        </p>
      </GuideSection>

      <GuideSection id="choose" title="Choosing on a given day">
        <p>
          If you work near downtown and can catch a morning 91 or E, the bus spares you the drive and
          parking. If you are going somewhere along the rail line, such as Pearlridge, the airport or
          Kalihi, a bus to Skyline is often more direct. Nalu compares the drive with every bus and
          bus-plus-rail combination for your exact trip and tells you which is faster right now.
        </p>
        <p>
          Timetables change a few times a year; the latest changes took effect on August 23, 2026. Check{" "}
          <Ext href="https://www.thebus.org/">thebus.org</Ext> for current schedules.
        </p>
      </GuideSection>
    </GuideLayout>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { GUIDES } from "@/components/guides/guides";
import { guideHead, type GuideFaq } from "@/components/guides/guide-head";
import { B, Ext, GuideLayout, GuideList, GuideSection, GuideTable } from "@/components/guides/GuideLayout";

// Sources (checked October 2026): TheBus GTFS timetable valid Sept 28 to Dec 5, 2026
// (overnight trips by route, first and last trips, Skyline first and last trains,
// airport stops after Skyline closes); TheBus UH Mānoa information guide, effective
// 10/16/25 (TheBus phone line 808-848-5555 and TheBusHEA real-time arrivals).
const META = GUIDES.lateNight;

const FAQS: GuideFaq[] = [
  {
    q: "Does TheBus run 24 hours on Oʻahu?",
    a: "A few routes do. In the current timetable, Routes 2 and 40 have trips through the night, about once an hour after midnight. Route 42 runs until about 1:20 AM and starts again around 4 AM. Most routes stop running overnight, so check your route's last trip.",
  },
  {
    q: "What time does Skyline stop running?",
    a: "The last trains that run the whole line leave Kualakaʻi (East Kapolei) and Kahauiki (Kalihi Transit Center) at about 10:00 PM. A few later trains run only part of the line, and the last ones finish at about 10:35 PM.",
  },
  {
    q: "What time does the first train or bus run in the morning?",
    a: "Skyline's first trains leave at about 4:00 AM. Several buses start earlier: the CountryExpress C from about 2:50 AM, and the CountryExpress E and the 93 express from about 3:45 AM on weekdays. The A Line and W Line start at about 4:15 AM.",
  },
  {
    q: "What if I miss the last bus home?",
    a: "Check whether one of the overnight routes, such as Route 2 or 40, can get you close. If not, a rideshare or a ride from someone you know is the practical option. Nalu tells you at night whether a bus or train is still running for your trip, and offers Uber or Lyft when nothing is.",
  },
];

export const Route = createFileRoute("/guides/late-night-commuting")({
  head: () => guideHead({ ...META, faqs: FAQS }),
  component: LateNightGuidePage,
});

function LateNightGuidePage() {
  return (
    <GuideLayout
      breadcrumb="Late-night commuting"
      title="Late-night and early-morning commuting on Oʻahu"
      faqs={FAQS}
      related={["airport", "skyline", "ewa"]}
      intro={
        <p>
          Skyline runs from about 4:00 AM to 10:30 PM, so overnight trips on Oʻahu depend on TheBus, where
          Routes 2 and 40 keep running through the night, about once an hour after midnight. Route 42 runs
          until about 1:20 AM and the W Line until about 1:30 AM, and most other routes stop for the night,
          so it pays to know your last trip.
        </p>
      }
    >
      <GuideSection id="overnight" title="Buses that run late or overnight">
        <p>Times are from TheBus's official timetable for October to early December 2026.</p>
        <GuideTable
          caption="Late-night TheBus service (timetable, October 2026)"
          head={["Route", "Area", "Late-night service"]}
          rows={[
            ["2", "Kalihi Transit Center, downtown, Waikīkī", "Through the night, about once an hour after midnight"],
            ["40", "Honolulu to Mākaha, by way of the airport late at night", "Through the night, about once an hour after midnight; stops at the airport until about 3:45 AM"],
            ["42", "ʻEwa Beach to Waikīkī", "Last trip toward ʻEwa Beach leaves Waikīkī at about 1:20 AM; service restarts around 4 AM"],
            ["W Line", "Airport to Waikīkī", "Last trips leave Waikīkī at about 12:30 AM and the airport at about 1:30 AM"],
            ["51", "Honolulu to Wahiawa, by way of Mililani", "Last trips around midnight to 1 AM"],
          ]}
        />
        <p>
          After Skyline closes, some late Route 40, 42 and 51 trips stop at the airport, which can help if you work a
          late shift there.
        </p>
      </GuideSection>

      <GuideSection id="early" title="Early-morning starts">
        <GuideList
          items={[
            <><B>Skyline:</B> first trains at about 4:00 AM from both ends, every 10 minutes from then on.</>,
            <><B>CountryExpress C</B> (Mākaha, Kapolei, downtown, Ala Moana): first trips from about 2:50 AM.</>,
            <><B>CountryExpress E</B> (ʻEwa Beach, downtown, Waikīkī): first trip toward town at about 3:45 AM on weekdays.</>,
            <><B>93 Waianae Coast Express:</B> first trip toward downtown at about 3:45 AM on weekdays.</>,
            <><B>A Line and W Line:</B> from about 4:15 AM.</>,
          ]}
        />
      </GuideSection>

      <GuideSection id="skyline" title="Skyline's last trains">
        <p>
          The last trains that run the full line leave Kualakaʻi (East Kapolei) and Kahauiki (Kalihi
          Transit Center) at about 10:00 PM. Later trains, up to about 10:30 PM, run only part of the
          line; for example, the last westbound train from Kahauiki goes only as far as Kalauao
          (Pearlridge). If you are going to the far end of the line after 10 PM, check your exact train.
        </p>
      </GuideSection>

      <GuideSection id="safety" title="Practical tips for night trips">
        <GuideList
          items={[
            <>Check live arrivals before you walk to the stop. <Ext href="https://hea.thebus.org/">TheBusHEA</Ext> shows estimated arrivals at any stop, and TheBus information line is (808) 848-5555.</>,
            <>Wait at a lit, busy stop or station when you can, and keep your phone charged.</>,
            <>Let someone know your plan and when you expect to get home.</>,
            <>Know your backup, such as a later overnight route, a rideshare or a ride from someone you know, before the last bus leaves.</>,
            <>Sit where you are comfortable, and get off at a busier stop if you would rather walk a little farther on a lit street.</>,
          ]}
        />
      </GuideSection>

      <GuideSection id="nalu" title="How Nalu helps at night">
        <p>
          From 9 PM to 5 AM, Nalu's answer focuses on whether a bus or train is still running for your
          trip tonight. It tells you when you are looking at the last trip, or that nothing leaves until
          morning and when the first trip is, and offers Uber or Lyft when that is the better choice. You
          can also turn on last-bus and get-home-safe alerts so you hear about it before it is too late.
        </p>
      </GuideSection>
    </GuideLayout>
  );
}

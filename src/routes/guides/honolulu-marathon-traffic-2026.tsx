import { createFileRoute } from "@tanstack/react-router";
import { GUIDES } from "@/components/guides/guides";
import { guideHead, type GuideFaq } from "@/components/guides/guide-head";
import { B, Ext, GuideLayout, GuideList, GuideSection } from "@/components/guides/GuideLayout";

// Sources (checked October 5, 2026): Honolulu Marathon official site (2026 date,
// 5:00 AM start at Ala Moana Boulevard and Queen Street, finish at Kapiʻolani Park,
// no time limit); the marathon's 2025 traffic advisory PDF, uploaded November 2025;
// 2025 closure coverage from KITV, KHON, Spectrum News and the Honolulu Police
// Department. No 2026 closure list had been published when this page was written.
const META = GUIDES.marathon;

const FAQS: GuideFaq[] = [
  {
    q: "When is the 2026 Honolulu Marathon?",
    a: "Sunday, December 13, 2026. The race starts at 5:00 AM on Ala Moana Boulevard at Queen Street and finishes at Kapiʻolani Park.",
  },
  {
    q: "When do roads close for the Honolulu Marathon?",
    a: "The 2026 closure times had not been published as of early October 2026. In 2025, lane closures began at 12:30 AM, the major closures near the start and on H-1 eastbound began at 3:30 AM, and roads reopened in stages as runners cleared each section.",
  },
  {
    q: "Where can I find the official 2026 road closures?",
    a: "On the Honolulu Marathon's website. In 2025 the official traffic advisory was posted in November, and local TV news and the Honolulu Police Department shared it in the days before the race.",
  },
  {
    q: "Is Skyline affected by the Honolulu Marathon?",
    a: "Skyline does not run along the marathon course, which goes from downtown through Waikīkī, around Diamond Head and out to Hawaiʻi Kai. Skyline's first trains run at about 4:00 AM as usual, but bus connections into town may be detoured.",
  },
  {
    q: "Will TheBus run on marathon day?",
    a: "Yes, but in 2025 some routes were canceled or detoured around the course. Check thebus.org or call (808) 848-5555 for the 2026 changes.",
  },
];

export const Route = createFileRoute("/guides/honolulu-marathon-traffic-2026")({
  head: () =>
    guideHead({
      ...META,
      faqs: FAQS,
      extraGraph: [
        {
          "@type": "SportsEvent",
          name: "Honolulu Marathon 2026",
          startDate: "2026-12-13T05:00:00-10:00",
          eventStatus: "https://schema.org/EventScheduled",
          location: {
            "@type": "Place",
            name: "Ala Moana Boulevard at Queen Street",
            address: { "@type": "PostalAddress", addressLocality: "Honolulu", addressRegion: "HI", addressCountry: "US" },
          },
          url: "https://www.honolulumarathon.org/",
        },
      ],
    }),
  component: MarathonGuidePage,
});

function MarathonGuidePage() {
  return (
    <GuideLayout
      breadcrumb="Honolulu Marathon traffic"
      title="Honolulu Marathon 2026: traffic and road closures"
      faqs={FAQS}
      related={["lateNight", "skyline", "airport"]}
      intro={
        <p>
          The 2026 Honolulu Marathon is on Sunday, December 13, starting at 5:00 AM on Ala Moana Boulevard
          at Queen Street and finishing at Kapiʻolani Park, with roads along the course closing in the early
          morning and reopening in stages as runners pass. The official 2026 closure list had not been
          published as of early October 2026; last year's was posted in November.
        </p>
      }
    >
      <GuideSection id="basics" title="Race-day basics">
        <GuideList
          items={[
            <><B>Date:</B> Sunday, December 13, 2026.</>,
            <><B>Start:</B> 5:00 AM, Ala Moana Boulevard at Queen Street.</>,
            <><B>Course:</B> through downtown and Waikīkī, around Diamond Head, through Kāhala and out to Hawaiʻi Kai, then back past Diamond Head to the finish.</>,
            <><B>Finish:</B> Kapiʻolani Park.</>,
            <><B>No time limit:</B> the finish stays open until the last participant arrives, so closures on the course lift section by section rather than all at once.</>,
          ]}
        />
      </GuideSection>

      <GuideSection id="2025" title="What closed in 2025">
        <p>
          The 2026 plan may differ, but last year's official traffic advisory gives a good idea of what to
          expect. On Sunday, December 14, 2025:
        </p>
        <GuideList
          items={[
            <>Traffic control started at <B>12:30 AM</B>, with lanes along the course closed or coned until runners finished each section.</>,
            <>Ala Moana Boulevard from Atkinson Drive to Ward Avenue was detoured from 12:30 AM and reopened at about 8 AM.</>,
            <>From <B>3:30 AM</B>, King Street from Nuʻuanu Avenue to Kapiʻolani Boulevard closed (detour at Smith Street), and Kapiʻolani Boulevard closed in both directions from King Street to Piʻikoi Street.</>,
            <>From 3:30 AM, all H-1 eastbound traffic was routed off at the Waiʻalae Avenue / 22nd Avenue off-ramp. H-1 partly reopened to a contraflow lane at about 8:30 AM.</>,
            <>Kalanianaʻole Highway had restricted access and contraflow in East Honolulu from 3:30 AM, with detours onto side streets, including Hawaiʻi Kai Drive.</>,
            <>Tow-away zones were in effect from midnight to 5 PM on race day.</>,
          ]}
        />
      </GuideSection>

      <GuideSection id="plan" title="How to plan around it">
        <GuideList
          items={[
            <><B>Leeward and Central Oʻahu trips</B> that stay west of downtown are unlikely to be affected. Skyline runs its normal schedule from about 4:00 AM.</>,
            <><B>Trips into downtown, Kakaʻako, Ala Moana, Waikīkī or East Honolulu</B> on Sunday morning should expect closures and detours. If you can, travel before the closures or after the course reopens near you.</>,
            <><B>Going to the airport</B> from Waikīkī or East Honolulu early that morning: allow extra time and check the closure map for your route.</>,
            <><B>TheBus:</B> in 2025 some routes were canceled or detoured. Check <Ext href="https://www.thebus.org/">thebus.org</Ext> or call (808) 848-5555 closer to the date.</>,
          ]}
        />
        <p>
          Watch for the official 2026 traffic advisory on the{" "}
          <Ext href="https://www.honolulumarathon.org/">Honolulu Marathon website</Ext>. It usually
          appears in the weeks before the race.
        </p>
      </GuideSection>

      <GuideSection id="nalu" title="Using Nalu on race day">
        <p>
          Nalu's drive times come from TomTom live traffic, so on the morning itself they reflect what
          traffic is actually doing on open roads. Live data does not always know every planned closure in
          advance, so check the official closure map as well, especially for trips that cross the course.
        </p>
      </GuideSection>
    </GuideLayout>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { GUIDES } from "@/components/guides/guides";
import { guideHead, type GuideFaq } from "@/components/guides/guide-head";
import { B, Ext, GuideLayout, GuideList, GuideSection } from "@/components/guides/GuideLayout";
import { StatTiles } from "@/components/guides/GuideBlocks";

// Sources (checked October 5, 2026): Honolulu Marathon official site (2026 date,
// 5:00 AM start at Ala Moana Boulevard and Queen Street, finish at Kapiʻolani Park,
// no time limit); the marathon's 2025 traffic advisory PDF, uploaded November 2025;
// 2025 closure coverage from KITV, KHON, Spectrum News and the Honolulu Police
// Department. As of October 5 no 2026 closure list had been published (see the November 23 update below).
// Updated November 23, 2026: City and County of Honolulu Department of Transportation
// Services, 2026 special events list (honolulu.gov/dts/2026-events/), Honolulu Marathon
// entry for Dec 13, 2026 (status "submitted", times "approximate"). The marathon's own 2026
// traffic advisory was not found as of that date.
const META = GUIDES.marathon;

const FAQS: GuideFaq[] = [
  {
    q: "When is the 2026 Honolulu Marathon?",
    a: "Sunday, December 13, 2026. The race starts at 5:00 AM on Ala Moana Boulevard at Queen Street and finishes at Kapiʻolani Park.",
  },
  {
    q: "When do roads close for the Honolulu Marathon?",
    a: "The marathon's own 2026 advisory had not been found as of November 23, 2026. The City and County of Honolulu's 2026 special events list shows the marathon's permit application (status: submitted) with roads closing at about 2:30 AM and reopening at about 4:00 PM. In 2025, lane closures began at 12:30 AM, the major closures near the start and on H-1 eastbound began at 3:30 AM, and roads reopened in stages as runners cleared each section.",
  },
  {
    q: "Where can I find the official 2026 road closures?",
    a: "On the Honolulu Marathon's website. In 2025 the official traffic advisory was posted in November, and local TV news and the Honolulu Police Department shared it in the days before the race. The City's special events list at honolulu.gov/dts/2026-events/ also shows the marathon's permit entry.",
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
      modified: "2026-11-23",
      extraGraph: [
        {
          "@type": "SportsEvent",
          name: "Honolulu Marathon 2026",
          startDate: "2026-12-13T05:00:00-10:00",
          eventStatus: "https://schema.org/EventScheduled",
          location: {
            "@type": "Place",
            name: "Ala Moana Boulevard at Queen Street",
            address: {
              "@type": "PostalAddress",
              addressLocality: "Honolulu",
              addressRegion: "HI",
              addressCountry: "US",
            },
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
      lastUpdated="November 2026"
      title="Honolulu Marathon 2026: traffic and road closures"
      faqs={FAQS}
      related={["lateNight", "skyline", "airport"]}
      intro={
        <p>
          The 2026 Honolulu Marathon is on Sunday, December 13, starting at 5:00 AM on Ala Moana
          Boulevard at Queen Street and finishing at Kapiʻolani Park. The City's permit entry shows
          roads closing at about 2:30 AM and reopening at about 4:00 PM; the marathon's own closure
          advisory had not been found as of November 23, 2026.
        </p>
      }
    >
      <GuideSection id="basics" title="Race-day basics">
        <StatTiles
          label="Race-day basics"
          items={[
            { value: "Dec 13", label: "Date", note: "Sunday, December 13, 2026." },
            {
              value: "5:00",
              unit: "AM",
              label: "Start",
              note: "Ala Moana Boulevard at Queen Street.",
            },
            { value: "Kapiʻolani Park", label: "Finish" },
          ]}
        />
        <GuideList
          items={[
            <>
              <B>Course:</B> through downtown and Waikīkī, around Diamond Head, through Kāhala and
              out to Hawaiʻi Kai, then back past Diamond Head to the finish.
            </>,
            <>
              <B>No time limit:</B> the finish stays open until the last participant arrives, so
              closures on the course lift section by section rather than all at once.
            </>,
          ]}
        />
      </GuideSection>

      <GuideSection id="2026" title="What the City's permit shows for 2026">
        <p>
          The City and County of Honolulu lists the marathon on its 2026 special events page. The
          entry is a permit application with the status "submitted", and its times are marked
          approximate, so treat it as a preview until the marathon posts its own advisory.
        </p>
        <GuideList
          items={[
            <>
              Roads close at about <B>2:30 AM</B> and reopen at about <B>4:00 PM</B>. The entry
              expects 15,000 or more runners.
            </>,
            <>
              <B>H-1</B> is listed as closed at the Waiʻalae Avenue off-ramp to Aina Koa Avenue.
            </>,
            <>
              <B>Kalanianaʻole Highway</B> is listed with the makai half closed for runners between Aina
              Koa Avenue and Kawaihae Street, the mauka half converted to contraflow, and all lanes
              closed between Kawaihae Street and Keahole Street.
            </>,
          ]}
        />
        <p>
          Source:{" "}
          <Ext href="https://www.honolulu.gov/dts/2026-events/">
            City and County of Honolulu, 2026 special events
          </Ext>{" "}
          (checked November 23, 2026).
        </p>
      </GuideSection>

      <GuideSection id="2025" title="What closed in 2025">
        <p>
          The 2026 plan may differ, but last year's official traffic advisory gives a good idea of
          what to expect. On Sunday, December 14, 2025:
        </p>
        <GuideList
          items={[
            <>
              Traffic control started at <B>12:30 AM</B>, with lanes along the course closed or
              coned until runners finished each section.
            </>,
            <>
              Ala Moana Boulevard from Atkinson Drive to Ward Avenue was detoured from 12:30 AM and
              reopened at about 8 AM.
            </>,
            <>
              From <B>3:30 AM</B>, King Street from Nuʻuanu Avenue to Kapiʻolani Boulevard closed
              (detour at Smith Street), and Kapiʻolani Boulevard closed in both directions from King
              Street to Piʻikoi Street.
            </>,
            <>
              From 3:30 AM, all H-1 eastbound traffic was routed off at the Waiʻalae Avenue / 22nd
              Avenue off-ramp. H-1 partly reopened to a contraflow lane at about 8:30 AM.
            </>,
            <>
              Kalanianaʻole Highway had restricted access and contraflow in East Honolulu from 3:30
              AM, with detours onto side streets, including Hawaiʻi Kai Drive.
            </>,
            <>Tow-away zones were in effect from midnight to 5 PM on race day.</>,
          ]}
        />
      </GuideSection>

      <GuideSection id="plan" title="How to plan around it">
        <GuideList
          items={[
            <>
              <B>Leeward and Central Oʻahu trips</B> that stay west of downtown are unlikely to be
              affected. Skyline runs its normal schedule from about 4:00 AM.
            </>,
            <>
              <B>Trips into downtown, Kakaʻako, Ala Moana, Waikīkī or East Honolulu</B> on Sunday
              morning should expect closures and detours. If you can, travel before the closures or
              after the course reopens near you.
            </>,
            <>
              <B>Going to the airport</B> from Waikīkī or East Honolulu early that morning: allow
              extra time and check the closure map for your route.
            </>,
            <>
              <B>TheBus:</B> in 2025 some routes were canceled or detoured. Check{" "}
              <Ext href="https://www.thebus.org/">thebus.org</Ext> or call (808) 848-5555 closer to
              the date.
            </>,
          ]}
        />
        <p>
          Watch for the official 2026 traffic advisory on the{" "}
          <Ext href="https://www.honolulumarathon.org/">Honolulu Marathon website</Ext>. It usually
          appears in the weeks before the race, and its times and closures take over from the
          City's permit preview above.
        </p>
      </GuideSection>

      <GuideSection id="nalu" title="Using Nalu on race day">
        <p>
          Nalu's drive times come from TomTom live traffic, so on the morning itself they reflect
          what traffic is actually doing on open roads. Live data does not always know every planned
          closure in advance, so check the official closure map as well, especially for trips that
          cross the course.
        </p>
      </GuideSection>
    </GuideLayout>
  );
}

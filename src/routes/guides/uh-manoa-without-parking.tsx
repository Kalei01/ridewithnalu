import { createFileRoute } from "@tanstack/react-router";
import { GUIDES } from "@/components/guides/guides";
import { UH_MANOA } from "@/components/guides/destinations";
import { guideHead, type GuideFaq } from "@/components/guides/guide-head";
import { B, Ext, GuideLayout, GuideList, GuideSection, GuideTable } from "@/components/guides/GuideLayout";

// Sources (checked October 2026): UH Mānoa Commuter Services pages on TheBus, Skyline
// and students; UH Mānoa Registrar mandatory student fees (U-PASS Transportation Fee);
// TheBus "University of Hawaii Manoa TheBus Information Guide", effective 10/16/25;
// thebus.org fares page (UH Mānoa U-Pass purchase details); TheBus GTFS timetable
// valid Sept 28 to Dec 5, 2026 (A and U Line times and frequency).
const META = GUIDES.uh;

const STEPS = [
  "Ride Skyline to Āhua (Lagoon Drive) station.",
  "Walk to TheBus stop #4852 at the station.",
  "Board the A Line to Sinclair Circle (stop #983), or the U Line on weekdays to Dole Street opposite East-West Road (stop #4550).",
  "Tap your Mānoa OneCard (U-Pass) or HOLO card each time you board.",
];

const FAQS: GuideFaq[] = [
  {
    q: "Does the UH Mānoa U-Pass work on Skyline?",
    a: "Yes. The U-Pass covers both TheBus and Skyline. Tap your Mānoa OneCard on the HOLO card reader when you board.",
  },
  {
    q: "How much is the U-Pass at UH Mānoa?",
    a: "There is no separate charge for most students. The U-Pass comes with the mandatory Student U-PASS Transportation Fee of $55 per fall and spring semester. Students in the School of Law, School of Medicine and Outreach College are not charged that fee.",
  },
  {
    q: "Which buses go to UH Mānoa?",
    a: "TheBus lists the A Line and U Line from Āhua (Lagoon Drive) Skyline station, plus Routes 4 (Nuʻuanu–Punahou–McCully), 6 (Pauoa–Woodlawn) and 13 (Liliha–Waikīkī–University). Route 13 comes from Waikīkī; Route 6 and the A Line come from Ala Moana.",
  },
  {
    q: "How do I get from Skyline to UH Mānoa?",
    a: "Get off Skyline at Āhua (Lagoon Drive) and take the A Line to Sinclair Circle, or the weekday U Line, which uses the H-1 freeway, to Dole Street by East-West Road.",
  },
  {
    q: "Is it hard to park at UH Mānoa?",
    a: "Parking on campus is limited and paid. UH Commuter Services sells semester permits and daily parking; check its website for current rates and availability before you plan to drive.",
  },
];

export const Route = createFileRoute("/guides/uh-manoa-without-parking")({
  head: () =>
    guideHead({
      ...META,
      faqs: FAQS,
      howTo: { name: "Get from Skyline to UH Mānoa", steps: STEPS },
    }),
  component: UhGuidePage,
});

function UhGuidePage() {
  return (
    <GuideLayout
      destination={UH_MANOA}
      take="If you are a UH student, the U-Pass covers both TheBus and Skyline, and campus parking is limited and paid, so riding is often the easy call. Get off at Āhua (Lagoon Drive) and take the A Line to Sinclair Circle, or the weekday U Line. I will tell you when to leave for your class time."
      breadcrumb="UH Mānoa without parking"
      title="Getting to UH Mānoa without parking"
      faqs={FAQS}
      related={["skyline", "lateNight", "kapolei"]}
      intro={
        <p>
          Most UH Mānoa students can ride TheBus and Skyline at no extra cost with the U-Pass, which is
          paid for through a mandatory $55 transportation fee each fall and spring semester. Routes 4, 6
          and 13 and the A and U Lines serve campus, and the A and U Lines connect to Skyline at Āhua
          (Lagoon Drive) station.
        </p>
      }
    >
      <GuideSection id="upass" title="How the U-Pass works">
        <GuideList
          items={[
            <><B>Who gets it:</B> full-time UH Mānoa undergraduate and graduate students who are enrolled and have paid the mandatory Student U-PASS Transportation Fee.</>,
            <><B>Cost:</B> the fee is $55 per fall and spring semester. Students in the School of Law, School of Medicine and Outreach College are not charged it.</>,
            <><B>Where it works:</B> TheBus and Skyline, during the fall and spring semesters.</>,
            <><B>How to use it:</B> tap your Mānoa OneCard on the HOLO card reader when you board.</>,
          ]}
        />
        <p>
          Students with a valid UH ID who are not in the fee-based program can buy a U-Pass at the Campus
          Center Ticket Office, Room 212, 2465 Campus Road, (808) 956-7236. TheBus notes that office takes
          cash only.
        </p>
      </GuideSection>

      <GuideSection id="routes" title="Bus routes that serve campus">
        <GuideTable
          caption="TheBus routes serving UH Mānoa (TheBus UH guide and timetable, October 2026)"
          head={["Route", "Where it comes from", "Notes"]}
          rows={[
            ["A Line", "Āhua (Lagoon Drive) Skyline station, through downtown on King Street and along Kapiʻolani Boulevard", "Every day. About every 10 to 15 minutes on weekdays and every 20 minutes on Sundays. Ends at Sinclair Circle."],
            ["U Line", "Āhua (Lagoon Drive) Skyline station by the H-1 freeway", "Weekdays only, about 5 AM to 5:30 PM, less often than the A Line. Stops on Dole Street."],
            ["Route 4", "Nuʻuanu, Punahou and McCully", "Also serves downtown."],
            ["Route 6", "Pauoa and Woodlawn", "Connects with Ala Moana Center."],
            ["Route 13", "Liliha and Waikīkī", "The direct route from Waikīkī."],
          ]}
        />
        <p>
          In the timetable, the A Line takes about 40 to 53 minutes from Āhua to Sinclair Circle on
          weekday mornings, and the U Line about 18 to 36 minutes from Āhua to Dole Street. Add the
          Skyline ride to Āhua: about 32 minutes from East Kapolei or 14 from Pearlridge.
        </p>
      </GuideSection>

      <GuideSection id="howto" title="Step by step: Skyline to campus">
        <ol className="grid list-decimal gap-2 pl-6">
          {STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p>
          Going home, board the A Line at Sinclair Circle (stop #983) or the U Line at Dole Street and
          East-West Road (stop #3674), ride to Āhua (stop #4850), and transfer to Skyline. These stop
          numbers come from UH Commuter Services.
        </p>
      </GuideSection>

      <GuideSection id="parking" title="If you do drive">
        <p>
          Campus parking is limited and paid, with semester permits and daily options sold through UH
          Commuter Services. Rates change, so check{" "}
          <Ext href="https://manoa.hawaii.edu/commuter/">manoa.hawaii.edu/commuter</Ext> for current
          prices before you count on a space.
        </p>
        <p>
          Nalu compares driving, including the drive time from live traffic, with the bus and
          Skyline for your exact trip to campus, and can remind you when to leave for class.
        </p>
      </GuideSection>
    </GuideLayout>
  );
}

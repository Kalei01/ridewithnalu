import { Link, createFileRoute } from "@tanstack/react-router";
import { GUIDES, GUIDES_HUB, GUIDE_ORDER } from "@/components/guides/guides";
import { guideHead, type GuideFaq } from "@/components/guides/guide-head";
import { GuideLayout, GuideSection } from "@/components/guides/GuideLayout";
import { SITE_URL } from "@/lib/site";

// Answers here repeat facts checked in the individual guides (October 2026).
const FAQS: GuideFaq[] = [
  {
    q: "What are Skyline's hours?",
    a: "Skyline runs every day from about 4:00 AM to 10:30 PM, every 10 minutes until about 8:30 PM and every 15 minutes after that.",
  },
  {
    q: "How much does TheBus or Skyline cost?",
    a: "An adult ride is $3.00 with a HOLO card, the same on TheBus and Skyline. It works as a 2-hour pass for transfers, and adult fares stop at $7.50 a day.",
  },
  {
    q: "Is it faster to drive or take transit on Oʻahu?",
    a: "It depends on the trip and the time. Outside rush hour, driving is often quicker. In heavy H-1 traffic, Skyline or an express bus can come out ahead. Nalu checks live traffic and the timetable for your exact trip and tells you which is faster right now.",
  },
];

export const Route = createFileRoute("/guides/")({
  head: () =>
    guideHead({
      ...GUIDES_HUB,
      faqs: FAQS,
      parents: [{ name: "Nalu", path: "/" }],
      extraGraph: [
        {
          "@type": "ItemList",
          name: "Oʻahu commute guides",
          itemListElement: [
            ...GUIDE_ORDER.map((slug, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: GUIDES[slug].name,
              url: SITE_URL + GUIDES[slug].path,
            })),
            {
              "@type": "ListItem",
              position: GUIDE_ORDER.length + 1,
              name: "Oʻahu commute guide: Skyline hours, fares and drive vs transit",
              url: SITE_URL + "/oahu-commute",
            },
            {
              "@type": "ListItem",
              position: GUIDE_ORDER.length + 2,
              name: "Install Nalu on iPhone or Android",
              url: SITE_URL + "/install",
            },
          ],
        },
      ],
    }),
  component: GuidesHubPage,
});

const cardClass = "block rounded-2xl border border-border bg-card/60 p-4 transition-colors hover:bg-accent";

function GuidesHubPage() {
  return (
    <GuideLayout
      breadcrumb="Guides"
      showHubCrumb={false}
      title="Oʻahu commute guides"
      faqs={FAQS}
      related={[]}
      intro={
        <p>
          These guides answer the questions people ask most about getting around Oʻahu: Skyline rail,
          TheBus, the airport, UH Mānoa, the drive from Kapolei, ʻEwa Beach and Mililani, late-night trips
          and Honolulu Marathon traffic. Each one is checked against TheBus's official timetable and other
          official sources, and Nalu gives you the live answer for your own trip.
        </p>
      }
    >
      <GuideSection id="all" title="All guides">
        <ul className="grid gap-3">
          {GUIDE_ORDER.map((slug) => {
            const guide = GUIDES[slug];
            return (
              <li key={slug}>
                <Link to={guide.path} className={cardClass}>
                  <span className="block text-lg font-semibold text-foreground">{guide.name}</span>
                  <span className="mt-1 block text-base leading-7 text-muted-foreground">{guide.summary}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </GuideSection>

      <GuideSection id="more" title="More from Nalu">
        <ul className="grid gap-3">
          <li>
            <Link to="/oahu-commute" className={cardClass}>
              <span className="block text-lg font-semibold text-foreground">Oʻahu commute guide</span>
              <span className="mt-1 block text-base leading-7 text-muted-foreground">
                Skyline at a glance and how Nalu compares driving with TheBus and Skyline.
              </span>
            </Link>
          </li>
          <li>
            <Link to="/install" className={cardClass}>
              <span className="block text-lg font-semibold text-foreground">Install Nalu on your phone</span>
              <span className="mt-1 block text-base leading-7 text-muted-foreground">
                Add Nalu to your Home Screen and turn on leave alerts.
              </span>
            </Link>
          </li>
        </ul>
      </GuideSection>
    </GuideLayout>
  );
}

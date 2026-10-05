import { Link, createFileRoute } from "@tanstack/react-router";
import { GUIDES } from "@/components/guides/guides";
import { guideHead, type GuideFaq } from "@/components/guides/guide-head";
import { B, GuideLayout, GuideList, GuideSection } from "@/components/guides/GuideLayout";
import { SITE_URL } from "@/lib/site";

// Sources: Nalu's own product facts in this repo (src/routes/install.tsx, privacy.tsx,
// welcome.tsx, the About section in index.tsx, src/lib/email/layout.ts for the contact
// address). "Made in Hawaiʻi" matches the existing About section. No founder details.
const META = GUIDES.about;

const FAQS: GuideFaq[] = [
  {
    q: "What is Nalu?",
    a: "Nalu is a free web app for Oʻahu that tells you whether to drive, take TheBus or ride Skyline for your trip right now, and when to leave. It then hands off to Google Maps, Apple Maps or a rideshare app.",
  },
  {
    q: "Is Nalu free? Do I need an account?",
    a: "Nalu is free and works without an account. The core answer and safety alerts will stay free. An optional free account saves places like Home and Work across your devices.",
  },
  {
    q: "Where does Nalu's information come from?",
    a: "Driving times come from TomTom live traffic. Bus and Skyline times come from TheBus's official GTFS timetable, with live TheBus arrivals where available. Weather comes from the National Weather Service, and planned lane closures come from the Hawaiʻi Department of Transportation.",
  },
  {
    q: "How do leave alerts work on iPhone?",
    a: "Apple only allows notifications from web apps added to the Home Screen, on iOS 16.4 or newer. Add Nalu to your Home Screen from Safari, open it from there, and allow notifications. The install guide at ridenalu.com/install walks through it.",
  },
  {
    q: "What does Nalu do with my location?",
    a: "Nalu uses precise location only while a trip is underway. If you turn on a leave alert, it stores the two ends of that trip rounded to about one block, the arrival time and the days you picked, so it can check traffic and the timetable. Turning the alert off deletes it. Analytics run only with your consent.",
  },
  {
    q: "How do I contact Nalu?",
    a: "Email hello@ridenalu.com.",
  },
];

export const Route = createFileRoute("/guides/about-nalu")({
  head: () =>
    guideHead({
      ...META,
      faqs: FAQS,
      extraGraph: [
        {
          "@type": "Organization",
          "@id": SITE_URL + "/#organization",
          name: "Nalu",
          url: SITE_URL,
          logo: SITE_URL + "/icons/icon-512.png",
          email: "hello@ridenalu.com",
          description: "Nalu is a free Oʻahu commute app that decides whether to drive, take TheBus or ride Skyline, and when to leave.",
        },
        {
          "@type": "SoftwareApplication",
          name: "Nalu",
          url: SITE_URL,
          applicationCategory: "TravelApplication",
          operatingSystem: "Web",
          isAccessibleForFree: true,
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          areaServed: { "@type": "Place", name: "Oʻahu, Hawaiʻi" },
        },
      ],
    }),
  component: AboutGuidePage,
});

function AboutGuidePage() {
  return (
    <GuideLayout
      breadcrumb="About Nalu"
      eyebrow="About · Press"
      title="About Nalu: FAQ and key facts"
      faqs={FAQS}
      related={["compare", "skyline", "lateNight"]}
      intro={
        <p>
          Nalu is a free web app for Oʻahu that tells you whether to drive, take TheBus or ride Skyline for
          your trip, and when to leave. It works in any phone browser at ridenalu.com, needs no account, and
          hands off to Google Maps, Apple Maps or a rideshare app once you have decided.
        </p>
      }
    >
      <GuideSection id="who" title="Who it is for">
        <p>
          Anyone getting around Oʻahu: daily commuters, students, visitors and people working late or early
          shifts. Nalu is not a full map app and does not try to replace Google Maps or Apple Maps. It makes
          the decision, then gets out of the way.
        </p>
      </GuideSection>

      <GuideSection id="facts" title="Key facts">
        <GuideList
          items={[
            <><B>Name:</B> Nalu</>,
            <><B>Website:</B> ridenalu.com</>,
            <><B>What it does:</B> compares driving, TheBus and Skyline for one trip and says which to take and when to leave.</>,
            <><B>Coverage:</B> the island of Oʻahu, Hawaiʻi.</>,
            <><B>Platform:</B> a web app for any modern phone or computer browser; it can be added to the Home Screen on iPhone and Android. It is not in the App Store.</>,
            <><B>Cost:</B> free, no account needed. The core answer and safety alerts stay free.</>,
            <><B>Data:</B> TomTom live traffic; TheBus's official GTFS timetable and live TheBus arrivals where available; National Weather Service weather; HDOT planned lane closures.</>,
            <><B>Features:</B> leave alerts, "Arrive by" planning, saved Home and Work, last-bus and get-home-safe alerts at night, live buses, voice guidance for drives, and a weekly summary of trips and estimated time saved.</>,
            <><B>Origin:</B> made in Hawaiʻi.</>,
            <><B>Contact:</B> <a href="mailto:hello@ridenalu.com" className="font-medium text-primary underline underline-offset-4">hello@ridenalu.com</a></>,
          ]}
        />
      </GuideSection>

      <GuideSection id="press" title="For press and writers">
        <p>
          You are welcome to describe Nalu using the key facts above. The app icon is available at{" "}
          <a href="/icons/icon-512.png" className="font-medium text-primary underline underline-offset-4">
            /icons/icon-512.png
          </a>{" "}
          (512 by 512 pixels). For interviews, corrections or anything else, email hello@ridenalu.com.
        </p>
        <img
          src="/icons/icon-512.png"
          alt="Nalu app icon"
          width={96}
          height={96}
          loading="lazy"
          className="size-24 rounded-[22%]"
        />
      </GuideSection>

      <GuideSection id="iphone" title="Alerts on iPhone">
        <p>
          On iPhone, leave alerts need Nalu on the Home Screen, opened from there, on iOS 16.4 or newer.{" "}
          <Link to="/install" className="font-medium text-primary underline underline-offset-4">
            The install guide
          </Link>{" "}
          shows how in a few taps, for iPhone and Android.
        </p>
      </GuideSection>

      <GuideSection id="privacy" title="Privacy in brief">
        <p>
          Nalu asks for only what a feature needs. Precise location is used while a trip is underway. Leave
          alerts store rounded trip ends, the arrival time and the days you chose, and nothing is stored if
          you do not turn one on. Analytics run only with your consent. The full{" "}
          <Link to="/privacy" className="font-medium text-primary underline underline-offset-4">
            privacy policy
          </Link>{" "}
          has the details.
        </p>
      </GuideSection>
    </GuideLayout>
  );
}

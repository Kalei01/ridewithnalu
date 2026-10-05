import { createFileRoute } from "@tanstack/react-router";
import { GUIDES } from "@/components/guides/guides";
import { guideHead, type GuideFaq } from "@/components/guides/guide-head";
import { B, GuideLayout, GuideList, GuideSection, GuideTable } from "@/components/guides/GuideLayout";

// Sources (checked October 2026): Nalu's own feature set (this repo); Spectrum News,
// August 28, 2025, and KHON on the Transit app partnership with Honolulu DTS
// (real-time TheBus and Skyline, trip planning with Biki and rideshare, alerts, offline
// schedules, free Royale); Honolulu Star-Advertiser, April 13, 2026 (Transit app covers
// TheBus and Skyline); Moovit's Honolulu TheBus and Skyline line pages; TheBus UH Mānoa
// guide (Google Maps transit, walking and driving directions).
const META = GUIDES.compare;

const FAQS: GuideFaq[] = [
  {
    q: "Is Nalu a replacement for Google Maps or Apple Maps?",
    a: "No. Nalu answers one question for Oʻahu: drive, TheBus or Skyline, and when to leave. Once you have decided, it hands you off to Google Maps, Apple Maps or a rideshare app. Keep using the map apps for navigation and finding places.",
  },
  {
    q: "What is the official transit app for TheBus and Skyline?",
    a: "The City and County of Honolulu's Department of Transportation Services partnered with the Transit app, which shows real-time TheBus and Skyline vehicles, plans trips with transfers, and sends service alerts. Honolulu riders get its premium features free through that partnership.",
  },
  {
    q: "How is Nalu different from Moovit or the Transit app?",
    a: "Moovit and Transit are built to guide a transit trip stop by stop. Nalu compares that transit trip with driving in live traffic for the same start and end, then tells you which to take and when to leave.",
  },
  {
    q: "Does Nalu work outside Oʻahu?",
    a: "No. Nalu covers Oʻahu only. For other places, use Google Maps, Apple Maps or a local transit app.",
  },
];

export const Route = createFileRoute("/guides/nalu-vs-google-maps")({
  head: () => guideHead({ ...META, faqs: FAQS }),
  component: CompareGuidePage,
});

function CompareGuidePage() {
  return (
    <GuideLayout
      breadcrumb="Nalu compared"
      title="Nalu compared with Google Maps, Apple Maps, Moovit and Transit"
      faqs={FAQS}
      related={["about", "skyline", "airport"]}
      intro={
        <p>
          Nalu answers one question for Oʻahu trips: should you drive, take TheBus or ride Skyline right
          now, and when should you leave. Google Maps and Apple Maps are better for turn-by-turn navigation
          and finding places, and Moovit and the Transit app are better for following a bus or train trip
          stop by stop, so Nalu decides first and then hands you off to them.
        </p>
      }
    >
      <GuideSection id="table" title="At a glance">
        <GuideTable
          caption="What each app is built for"
          head={["", "Nalu", "Google Maps / Apple Maps", "Moovit / Transit"]}
          rows={[
            ["Main job", "Decide: drive or transit, and when to leave", "Navigate anywhere, find places", "Guide a transit trip"],
            ["Where it works", "Oʻahu only", "Worldwide", "Many cities, including Honolulu"],
            ["Drive vs transit side by side", "Yes, one answer for your trip", "You compare the tabs yourself", "Transit focused"],
            ["Leave-time alerts for a regular commute", "Yes", "Not the main focus", "Not the main focus"],
            ["Turn-by-turn driving navigation", "Voice guidance for drives", "Yes, their strength", "Not their focus"],
            ["Searching for businesses and places", "Addresses and places to start a trip", "Yes, their strength", "Limited"],
            ["Live bus and train tracking", "Live TheBus arrivals where available", "Varies", "Yes, a strength"],
            ["Account needed", "No", "Optional", "Optional"],
          ]}
        />
      </GuideSection>

      <GuideSection id="nalu" title="What Nalu does that the others do not focus on">
        <GuideList
          items={[
            <><B>One verdict.</B> Nalu compares a live-traffic drive (TomTom) with TheBus and Skyline from the official timetable, including walking, waiting and transfers, and says which to take.</>,
            <><B>When to leave.</B> Leave alerts and "Arrive by" planning work backward from when you need to be there.</>,
            <><B>Oʻahu context.</B> Planned HDOT lane closures on your route, National Weather Service weather, and at night, whether the last bus or train is still running.</>,
            <><B>Free and simple.</B> No account needed; the core answer and safety alerts are free.</>,
          ]}
        />
      </GuideSection>

      <GuideSection id="others" title="Where the others are better">
        <GuideList
          items={[
            <><B>Google Maps and Apple Maps</B> are better for full turn-by-turn navigation, finding businesses and reviews, and any trip off Oʻahu. Google Maps also gives transit, walking and driving directions.</>,
            <><B>The Transit app</B> is Honolulu's official partner app, with real-time TheBus and Skyline tracking, trip planning that includes Biki and rideshare, service alerts and offline schedules.</>,
            <><B>Moovit</B> covers TheBus and Skyline with route maps, schedules and stops.</>,
          ]}
        />
      </GuideSection>

      <GuideSection id="together" title="Using them together">
        <p>
          A good routine is to open Nalu before you leave to decide whether to drive or ride and when to
          go, then follow the trip in the app you already like. If Nalu says drive, it can open Google Maps or
          Apple Maps, or guide you itself. If it says ride, it shows the bus or train to catch and when, and a transit app can
          guide you stop by stop. Late at night, Nalu can hand off to Uber or Lyft when no bus or train is
          left.
        </p>
      </GuideSection>
    </GuideLayout>
  );
}

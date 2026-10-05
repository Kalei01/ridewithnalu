import { createFileRoute } from "@tanstack/react-router";
import { WelcomeLanding } from "@/components/welcome/WelcomeLanding";
import { SITE_URL } from "@/lib/site";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "Nalu: Drive, TheBus or Skyline? Oʻahu Commute App" },
      {
        name: "description",
        content:
          "Free Oʻahu commute app: Nalu checks live traffic, TheBus and Skyline for your trip and tells you whether to drive or ride, and when to leave.",
      },
      { name: "robots", content: "index,follow,max-image-preview:large" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Nalu | Your Oʻahu commute, simplified" },
      {
        property: "og:description",
        content: "Check current traffic and your available options, then know when to leave.",
      },
      { property: "og:url", content: SITE_URL + "/" },
      { property: "og:site_name", content: "Nalu" },
      { property: "og:image", content: SITE_URL + "/social-card.png" },
      { name: "twitter:image", content: SITE_URL + "/social-card.png" },
      { name: "twitter:title", content: "Nalu | Your Oʻahu commute, simplified" },
      {
        name: "twitter:description",
        content: "Check current traffic and your available options, then know when to leave.",
      },
    ],
    // "/" shows this same introduction to first-time visitors, so it is the main URL.
    links: [{ rel: "canonical", href: SITE_URL + "/" }],
  }),
  component: WelcomePage,
});

function WelcomePage() {
  return <WelcomeLanding />;
}

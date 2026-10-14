import { createFileRoute } from "@tanstack/react-router";
import { HomeLanding } from "@/components/home/HomeLanding";
import { SITE_URL } from "@/lib/site";

/**
 * Preview of the new home page for Josh to approve on his phone before it
 * replaces the introduction at "/" (docs/experience/home-redesign.md). Not
 * indexed; its canonical is "/", where it will live.
 */
export const Route = createFileRoute("/home-preview")({
  head: () => ({
    meta: [
      { title: "Nalu: Drive, TheBus or Skyline? Oʻahu Commute App" },
      {
        name: "description",
        content:
          "Free Oʻahu commute app: Nalu checks live traffic, TheBus and Skyline for your trip and tells you whether to drive or ride, and when to leave.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
    links: [{ rel: "canonical", href: SITE_URL + "/" }],
  }),
  component: () => <HomeLanding />,
});

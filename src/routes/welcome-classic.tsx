import { createFileRoute } from "@tanstack/react-router";
import { WelcomeLanding } from "@/components/welcome/WelcomeLanding";
import { SITE_URL } from "@/lib/site";

/**
 * The previous introduction, kept reachable for one week after the new home
 * page replaced it at "/" (Josh approved Oct 14, 2026). Remove on or after
 * Oct 21, 2026, together with src/components/welcome/ (see docs/passdown/premium.md).
 */
export const Route = createFileRoute("/welcome-classic")({
  head: () => ({
    meta: [
      { title: "Nalu: Drive, TheBus or Skyline? Oʻahu Commute App" },
      { name: "robots", content: "noindex,nofollow" },
    ],
    links: [{ rel: "canonical", href: SITE_URL + "/" }],
  }),
  component: () => <WelcomeLanding />,
});

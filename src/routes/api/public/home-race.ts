import { createFileRoute } from "@tanstack/react-router";
import { tooMany, visitorLimit } from "@/lib/home/visitor-limit.server";
import { homeRace } from "@/lib/home/home-race.server";

const allow = visitorLimit(30);

/** The home page's race demo (Kapolei → downtown): one shared planner check every few minutes. */
export const Route = createFileRoute("/api/public/home-race")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!allow(request)) return tooMany();
        const race = await homeRace();
        return Response.json(race, {
          status: race ? 200 : 503,
          headers: { "cache-control": race ? "public, max-age=60" : "no-store" },
        });
      },
    },
  },
});

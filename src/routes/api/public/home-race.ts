import { createFileRoute } from "@tanstack/react-router";
import { homeRace } from "@/lib/home/home-race.server";

/** The home page's race demo (Kapolei → downtown): one shared planner check every few minutes. */
export const Route = createFileRoute("/api/public/home-race")({
  server: {
    handlers: {
      GET: async () => {
        const race = await homeRace();
        return Response.json(race, {
          status: race ? 200 : 503,
          headers: { "cache-control": race ? "public, max-age=60" : "no-store" },
        });
      },
    },
  },
});

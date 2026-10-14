import { createFileRoute } from "@tanstack/react-router";
import { tooMany, visitorLimit } from "@/lib/home/visitor-limit.server";
import { homeLive } from "@/lib/home/home-live.server";

const allow = visitorLimit(30);

/** The home page's "Right now on Oʻahu" strip and live island: one shared check, real data only. */
export const Route = createFileRoute("/api/public/home-live")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        allow(request)
          ? Response.json(await homeLive(), { headers: { "cache-control": "public, max-age=20" } })
          : tooMany(),
    },
  },
});

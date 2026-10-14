import { createFileRoute } from "@tanstack/react-router";
import { homeLive } from "@/lib/home/home-live.server";

/** The home page's "Right now on Oʻahu" strip and live island: one shared check, real data only. */
export const Route = createFileRoute("/api/public/home-live")({
  server: {
    handlers: {
      GET: async () =>
        Response.json(await homeLive(), {
          headers: { "cache-control": "public, max-age=20" },
        }),
    },
  },
});

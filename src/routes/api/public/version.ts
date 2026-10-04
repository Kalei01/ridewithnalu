import { createFileRoute } from "@tanstack/react-router";
import { BUILD_ID } from "@/lib/build-id";

/** Which version is live, so open apps know when to refresh. Never cached. */
export const Route = createFileRoute("/api/public/version")({
  server: {
    handlers: {
      GET: () =>
        Response.json({ build: BUILD_ID }, { headers: { "cache-control": "no-store, max-age=0" } }),
    },
  },
});

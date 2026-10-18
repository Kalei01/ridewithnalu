import { createFileRoute } from "@tanstack/react-router";
import { BrowseSheetScreen } from "@/components/commute/browse/BrowseSheetScreen";

/**
 * Preview of Browse as one live map with a bottom sheet (Phase 1 of the Browse
 * redesign, docs/experience/backlog.md). Not indexed, not linked, not in the
 * sitemap. The real Browse at "/" is unchanged.
 */
export const Route = createFileRoute("/browse-preview")({
  head: () => ({
    meta: [{ title: "Nalu Browse (preview)" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: BrowseSheetScreen,
});

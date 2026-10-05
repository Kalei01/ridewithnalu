import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Construction } from "lucide-react";
import { roadworkSummary } from "@/lib/roadwork";
import { getOahuRoadwork } from "@/lib/roadwork.functions";

/**
 * Browse: the state's planned lane closures this week, in one line, linking to
 * the full /roadwork list. A trip shows only the closures on its own route.
 */
export function RoadworkTile({ className = "" }: { className?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["oahu-roadwork"],
    queryFn: () => getOahuRoadwork(),
    staleTime: 30 * 60_000,
  });
  const line = isLoading
    ? "Checking the state’s list…"
    : data?.ok
      ? roadworkSummary(data.closures)
      : "Can’t load the state’s list right now";
  return (
    <Link
      to="/roadwork"
      className={`glass-panel flex min-h-14 items-center gap-3 rounded-lg px-4 py-3 ${className}`}
    >
      <Construction aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
      <span className="min-w-0">
        <span className="block text-base font-bold text-foreground">Roadwork this week</span>
        {/* Non-breaking hyphens keep "H-2" on one line. */}
        <span className="block break-words text-sm text-muted-foreground">
          {line.replace(/\bH-(\d)/g, "H\u2011$1")}
        </span>
      </span>
      <ChevronRight aria-hidden="true" className="ml-auto size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

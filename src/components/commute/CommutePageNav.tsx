import { Link } from "@tanstack/react-router";
import { House, MapPin } from "lucide-react";

export function CommutePageNav({
  current,
  onBrowse,
}: {
  current: "browse" | "commute";
  onBrowse: () => void;
}) {
  const itemClass =
    "flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors";
  const activeClass = "bg-recommended text-recommended-foreground shadow-sm";
  const inactiveClass = "text-muted-foreground hover:bg-background/60 hover:text-foreground";

  return (
    <nav
      className="mt-4 flex items-center gap-1 rounded-full border border-border/70 bg-surface-raised/70 p-1 backdrop-blur-md"
      aria-label="Nalu pages"
    >
      <Link
        to="/welcome"
        className={itemClass + " " + inactiveClass}
        aria-label="Nalu landing page"
      >
        <House className="size-3.5" />
        Nalu
      </Link>
      <button
        type="button"
        onClick={onBrowse}
        className={itemClass + " " + (current === "browse" ? activeClass : inactiveClass)}
        aria-current={current === "browse" ? "page" : undefined}
      >
        <MapPin className="size-3.5" />
        Browse
      </button>
    </nav>
  );
}

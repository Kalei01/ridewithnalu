import { CornerUpRight } from "lucide-react";

/**
 * Big, uncluttered naming of the roads to take. Names come from live routing
 * guidance, never a hardcoded route list.
 */
export function RouteCorridor({
  label,
  size = "large",
}: {
  label: string | null | undefined;
  size?: "large" | "compact";
}) {
  if (!label) return null;
  return (
    <div className={size === "large" ? "mt-6" : "mt-4"}>
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        <CornerUpRight className="size-3.5" /> Route
      </p>
      <p
        className={`mt-1 font-bold leading-tight text-foreground ${
          size === "large" ? "text-2xl" : "text-lg"
        }`}
      >
        {label}
      </p>
    </div>
  );
}

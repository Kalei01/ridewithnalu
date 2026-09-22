import { CornerUpRight, ShieldCheck } from "lucide-react";

/**
 * Big, uncluttered naming of the roads to take, plus any known backup this
 * route avoids. Names come from live routing guidance, never a hardcoded list.
 */
export function RouteCorridor({
  label,
  bypassed,
  size = "large",
}: {
  label: string | null | undefined;
  bypassed?: string[];
  size?: "large" | "compact";
}) {
  if (!label) return null;
  const skipped = (bypassed ?? []).filter(Boolean);
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
      {skipped.length > 0 && (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-recommended/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-recommended">
          <ShieldCheck className="size-3.5" />
          Skips {skipped.join(" & ")} backup
        </p>
      )}
    </div>
  );
}

import { cn } from "@/lib/utils";

/**
 * "Ride it. Drive it. Just go." set as a brand line: spaced capitals with
 * small dots between the phrases, and "Just go" in Nalu blue.
 */
export function Tagline({ className, size = "sm" }: { className?: string; size?: "sm" | "md" }) {
  const dot = (
    <span
      aria-hidden="true"
      className={cn("shrink-0 rounded-full bg-muted-foreground/45", size === "md" ? "size-1.5" : "size-1")}
    />
  );
  return (
    <p
      className={cn(
        "flex items-center whitespace-nowrap font-semibold uppercase text-muted-foreground",
        size === "md" ? "gap-2.5 text-sm tracking-[0.22em]" : "gap-1.5 text-[0.6875rem] tracking-[0.14em]",
        className,
      )}
    >
      <span className="sr-only">Ride it. Drive it. Just go.</span>
      <span aria-hidden="true">Ride it</span>
      {dot}
      <span aria-hidden="true">Drive it</span>
      {dot}
      <span aria-hidden="true" className="text-primary">
        Just go
      </span>
    </p>
  );
}

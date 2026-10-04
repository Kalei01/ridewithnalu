import { Car } from "lucide-react";
import { rideshareLinks } from "@/lib/night/night-status";

/**
 * Where Nalu has no bus or train data (the San Francisco test), offer a ride
 * to this trip's destination alongside the drive answer.
 */
export function RideCard({ destination }: { destination: { lat: number; lon: number; name: string } }) {
  const links = rideshareLinks(destination);
  const button =
    "flex h-12 items-center justify-center gap-2 rounded-lg border border-border bg-background/60 text-base font-semibold text-foreground";
  return (
    <section className="mt-4 rounded-2xl border border-border bg-background/40 p-4" aria-label="Get a ride">
      <p className="text-base font-semibold text-foreground">Rather not drive? Get a ride there</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <a href={links.uber} className={button}>
          <Car className="size-4" /> Uber
        </a>
        <a href={links.lyft} className={button}>
          <Car className="size-4" /> Lyft
        </a>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Opens the app with this destination filled in. Nalu can't see their prices or wait times.</p>
    </section>
  );
}

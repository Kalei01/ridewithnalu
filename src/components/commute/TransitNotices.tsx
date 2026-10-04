import { CreditCard, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { HOLO_FARES } from "@/lib/fares";
import { landmarkFor } from "@/lib/landmarks";

/** Subtle landmark line under a data-derived stop or station name. */
export function LandmarkHint({ name }: { name: string | null | undefined }) {
  const landmark = landmarkFor(name);
  if (!landmark) return null;
  return (
    <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground" title={landmark}>
      {landmark}
    </p>
  );
}

/** Prominent fare entry point with an outdoor-readable accessible dialog. */
export function FareNotice() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="mt-3 h-auto min-h-14 w-full justify-between border-primary/40 bg-primary/10 px-4 py-3 text-left shadow-sm hover:bg-primary/15"
        >
          <span className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground">
              <CreditCard className="size-5" />
            </span>
            <span>
              <span className="block text-base font-bold text-foreground">HOLO® Card &amp; Fares</span>
              <span className="block text-xs text-muted-foreground">Payment and transfer details</span>
            </span>
          </span>
          <Info className="size-5 text-primary" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88dvh] max-w-md overflow-y-auto border-primary/30 bg-background p-6">
        <DialogHeader className="pr-7 text-left">
          <DialogTitle className="flex items-center gap-2 text-2xl text-foreground">
            <CreditCard className="size-6 text-primary" /> HOLO® Card &amp; Fares
          </DialogTitle>
          <DialogDescription className="text-base leading-relaxed text-muted-foreground">
            What to know before riding TheBus or Skyline.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <FareFact title={`${HOLO_FARES.singleRide} Single Ride`}>
            Includes free transfers between TheBus and Skyline within {HOLO_FARES.transferWindowHours} hours.
          </FareFact>
          <FareFact title={`${HOLO_FARES.dailyCap} Daily Cap`}>
            Unlimited rides on TheBus and Skyline once reached in a single day.
          </FareFact>
          <FareFact title="Kūpuna (65+) Discount">
            {HOLO_FARES.seniorRide} per ride with a {HOLO_FARES.seniorDailyCap} daily cap using a Senior HOLO card.
          </FareFact>
          <FareFact title="Skyline Requirement">
            Skyline gates strictly require a HOLO card or mobile tap. Cash is not accepted at rail stations.
          </FareFact>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FareFact({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-border bg-surface-raised p-4">
      <h3 className="text-lg font-bold text-foreground">{title}</h3>
      <p className="mt-1 text-base leading-relaxed text-foreground">{children}</p>
    </section>
  );
}

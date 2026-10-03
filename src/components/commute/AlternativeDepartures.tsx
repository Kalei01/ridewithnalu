import type { ReactNode } from "react";
import { Clock3 } from "lucide-react";

type AlternativeDeparturesProps = {
  children: ReactNode;
};

export function AlternativeDepartures({ children }: AlternativeDeparturesProps) {
  return (
    <section
      className="alternative-panel mb-8 min-w-0 max-w-full overflow-hidden rounded-lg p-4 sm:p-5"
      aria-labelledby="later-title"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full border border-recommended/35 bg-recommended/10 text-recommended">
          <Clock3 className="size-4" />
        </span>
        <div>
          <h2 id="later-title" className="text-xl font-bold text-foreground">
            Alternative departures
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Choose another trip.
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}

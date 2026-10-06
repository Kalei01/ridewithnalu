import { createFileRoute } from "@tanstack/react-router";
import { LegalFooter } from "@/components/LegalFooter";
import { SITE_URL } from "@/lib/site";

export const Route = createFileRoute("/disclaimer")({
  head: () => ({
    meta: [
      { title: "Commute Disclaimer | Nalu" },
      {
        name: "description",
        content: "Nalu's commute information disclaimer for traffic, transit, weather, routing, and arrival estimates.",
      },
      { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: SITE_URL + "/disclaimer" }],
  }),
  component: DisclaimerPage,
});

function DisclaimerPage() {
  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Nalu</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight">Commute Disclaimer</h1>
          <p className="mt-3 text-sm text-muted-foreground">Last updated September 30, 2026</p>
        </header>

        <div className="mt-10 space-y-8 text-sm leading-7 text-muted-foreground">
          <section>
            <h2 className="text-lg font-bold text-foreground">Commute information can change</h2>
            <p className="mt-2">Traffic, crashes, road closures, construction, transit operations, weather, and other conditions can change after Nalu receives information about them. Data sources can also be delayed, incomplete, or unavailable.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">Estimates are estimates</h2>
            <p className="mt-2">Drive times, transit times, departure suggestions, and arrival estimates are planning aids. They are not guarantees and should not be treated as exact predictions.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">Use official information when it matters</h2>
            <p className="mt-2">For emergencies, road closures, official transit notices, safety instructions, and other time-critical information, rely on the appropriate official source. Always follow traffic laws, posted signs, and transit rules.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">Make your own travel decision</h2>
            <p className="mt-2">Nalu is designed to help you compare commute options. You remain responsible for deciding how and when to travel and for allowing enough time for your trip.</p>
          </section>
        </div>

        <LegalFooter />
      </div>
    </main>
  );
}

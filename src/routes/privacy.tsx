import { createFileRoute } from "@tanstack/react-router";
import { LegalFooter } from "@/components/LegalFooter";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy | Nalu" },
      {
        name: "description",
        content: "Nalu's privacy policy explains what information may be used to provide the Oʻahu commute service and how it is handled.",
      },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Nalu</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight">Privacy Policy</h1>
          <p className="mt-3 text-sm text-muted-foreground">Last updated September 30, 2026</p>
        </header>

        <div className="mt-10 space-y-8 text-sm leading-7 text-muted-foreground">
          <section>
            <h2 className="text-lg font-bold text-foreground">What this policy covers</h2>
            <p className="mt-2">This policy describes how Nalu may handle information when you use the Nalu website and commute service.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">Information you provide</h2>
            <p className="mt-2">Depending on how you use Nalu, you may provide account information, saved places such as Home and Work, trip details, feedback, and other information you choose to enter.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">Location and trip information</h2>
            <p className="mt-2">Nalu uses trip information you enter or request to provide commute planning, routing, traffic, transit, weather, and related features. If you use a feature that requires a location, that information may be processed by Nalu and by relevant service providers needed to return the requested result.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">How information is used</h2>
            <p className="mt-2">Information may be used to provide and improve Nalu, maintain accounts and saved places, respond to feedback, protect the service, troubleshoot problems, and provide the commute features you request.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">Service providers</h2>
            <p className="mt-2">Nalu relies on third-party services for functions such as authentication, routing, geocoding, traffic, transit, weather, air quality, and feedback. Those providers may process information according to their own terms and privacy policies. Nalu only requests information reasonably needed for the related feature.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">Storage and security</h2>
            <p className="mt-2">Nalu uses reasonable technical and organizational measures intended to protect information. No internet service can guarantee absolute security, and you should avoid entering information that you do not want processed by an online service.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">Your choices</h2>
            <p className="mt-2">You can choose whether to use guest features or create an account. You can also manage information you save in Nalu and request help with account or personal information through the available Nalu contact or feedback options.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">Children</h2>
            <p className="mt-2">Nalu is a general-audience commute service and is not directed to children under 13. We do not knowingly seek personal information from children under 13.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">Changes to this policy</h2>
            <p className="mt-2">We may update this policy as Nalu changes. The date above indicates when the current version was last updated.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">Contact</h2>
            <p className="mt-2">For privacy questions or requests, use the available Nalu feedback or contact option in the service.</p>
          </section>
        </div>

        <LegalFooter />
      </div>
    </main>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { LegalFooter } from "@/components/LegalFooter";
import { SITE_URL } from "@/lib/site";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service | Nalu" },
      {
        name: "description",
        content: "Terms of Service for using Nalu, an Oʻahu commute decision and planning service.",
      },
      { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: SITE_URL + "/terms" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Nalu</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight">Terms of Service</h1>
          <p className="mt-3 text-sm text-muted-foreground">Last updated September 30, 2026</p>
        </header>

        <div className="mt-10 space-y-8 text-sm leading-7 text-muted-foreground">
          <section>
            <h2 className="text-lg font-bold text-foreground">Using Nalu</h2>
            <p className="mt-2">Nalu is an Oʻahu commute decision and planning service. By using Nalu, you agree to use the service lawfully and not to interfere with its operation, misuse accounts, or attempt to access systems or information you are not authorized to use.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">Commute information</h2>
            <p className="mt-2">Nalu combines information from available traffic, routing, transit, weather, air-quality, and other sources. Information can be delayed, incomplete, unavailable, or inaccurate. Nalu does not guarantee travel times, route availability, transit operations, or arrival times.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">Your responsibility</h2>
            <p className="mt-2">You are responsible for your travel decisions. Follow posted signs, traffic laws, transit rules, and official instructions. Do not use Nalu while driving or in any situation where interacting with a device would be unsafe or unlawful.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">Accounts and saved information</h2>
            <p className="mt-2">If you create an account, you are responsible for maintaining the security of your account credentials and for activity under your account. You should keep saved places and other account information accurate.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">Third-party services</h2>
            <p className="mt-2">Nalu depends on third-party services and data sources. Those services may change or become unavailable, and their own terms may apply to information they provide or process.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">Availability and changes</h2>
            <p className="mt-2">Nalu may change, suspend, or discontinue features as the service develops. We may also update these terms when necessary. Continued use after an update means you accept the updated terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">Disclaimer of warranties</h2>
            <p className="mt-2">Nalu is provided on an as-available basis. To the extent permitted by law, Nalu makes no guarantee that the service will always be uninterrupted, complete, current, or error-free.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">Limitation of liability</h2>
            <p className="mt-2">To the extent permitted by law, Nalu and its operators will not be responsible for losses or damages arising from reliance on commute information, service interruptions, third-party data, or use of the service.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">Contact</h2>
            <p className="mt-2">Questions about these terms can be submitted through the available Nalu feedback or contact option in the service.</p>
          </section>
        </div>

        <LegalFooter />
      </div>
    </main>
  );
}

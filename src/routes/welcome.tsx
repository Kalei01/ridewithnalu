import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { AccountSection } from "@/components/account/AccountSection";

const SITE_URL = "https://ridewithnalu.lovable.app";

function HonuMark() {
  return (
    <div className="relative flex size-16 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,.16),0_18px_45px_rgba(0,0,0,.35)]">
      <svg viewBox="0 0 64 48" className="size-10 text-[var(--nalu-sapphire)]" fill="none" aria-hidden="true">
        <ellipse cx="32" cy="25" rx="18" ry="11" stroke="currentColor" strokeWidth="2.4" opacity=".9" />
        <path d="M32 14v22M18 25h28M22 18.5 32 25l10-6.5M22 31.5 32 25l10 6.5" stroke="currentColor" strokeWidth="1.5" opacity=".65" />
        <path d="M14 23 6 17l3 9-3 8 8-5M50 23l8-6-3 9 3 8-8-5M24 35l-5 8 9-4M40 35l5 8-9-4M29 36h6l-3 7Z" fill="currentColor" opacity=".85" />
      </svg>
    </div>
  );
}

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "Nalu | Your Oʻahu commute, simplified" },
      {
        name: "description",
        content:
          "Nalu helps Oʻahu commuters compare driving, Skyline rail, and TheBus and decide when to leave.",
      },
      { name: "robots", content: "index,follow,max-image-preview:large" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Nalu | Your Oʻahu commute, simplified" },
      {
        property: "og:description",
        content: "Compare driving, Skyline rail, and TheBus for your Oʻahu commute.",
      },
      { property: "og:url", content: SITE_URL + "/welcome" },
      { property: "og:site_name", content: "Nalu" },
      { name: "twitter:title", content: "Nalu | Your Oʻahu commute, simplified" },
      {
        name: "twitter:description",
        content: "Compare driving, Skyline rail, and TheBus for your Oʻahu commute and plan when to leave.",
      },
    ],
    links: [{ rel: "canonical", href: SITE_URL + "/welcome" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebSite",
              "@id": SITE_URL + "/#website",
              name: "Nalu",
              url: SITE_URL,
              description: "An Oʻahu commute app that helps commuters compare driving, Skyline rail, and TheBus.",
            },
            {
              "@type": "Organization",
              "@id": SITE_URL + "/#organization",
              name: "Nalu",
              url: SITE_URL,
              description: "Nalu is an Oʻahu-focused commute decision tool.",
            },
            {
              "@type": "SoftwareApplication",
              "@id": SITE_URL + "/#app",
              name: "Nalu",
              url: SITE_URL,
              description: "Nalu helps Oʻahu commuters compare driving, Skyline rail, and TheBus and plan when to leave.",
              applicationCategory: "TravelApplication",
              operatingSystem: "Web",
              publisher: { "@id": SITE_URL + "/#organization" },
              isAccessibleForFree: true,
            },
            {
              "@type": "WebPage",
              "@id": SITE_URL + "/welcome#webpage",
              name: "Nalu | Your Oʻahu commute, simplified",
              url: SITE_URL + "/welcome",
              description: "The public introduction to Nalu, an Oʻahu commute decision app.",
              isPartOf: { "@id": SITE_URL + "/#website" },
              about: { "@id": SITE_URL + "/#app" },
            },
          ],
        }),
      },
    ],
  }),
  component: WelcomePage,
});

function WelcomePage() {
  useEffect(() => {
    try {
      window.localStorage.setItem("nalu-welcome-seen-v1", "1");
    } catch {
      /* private mode: gate treats unreadable storage as seen */
    }
  }, []);

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(105,183,245,.14),transparent_32%),radial-gradient(circle_at_85%_65%,rgba(104,211,161,.08),transparent_30%)]" />
      <div className="pointer-events-none absolute -right-28 top-20 size-72 rounded-full border border-white/[0.04]" />
      <div className="pointer-events-none absolute -left-36 bottom-10 size-80 rounded-full border border-white/[0.035]" />

      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-5xl flex-col px-5 pb-8 pt-7 sm:px-8 sm:pt-10">
        <header className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3" aria-label="Open Nalu">
            <HonuMark />
            <div>
              <p className="text-lg font-black tracking-tight">Nalu</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Oʻahu commute</p>
            </div>
          </Link>
          <Link
            to="/"
            className="rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 text-sm font-semibold text-muted-foreground backdrop-blur-xl transition hover:border-white/20 hover:text-foreground"
          >
            Browse
          </Link>
        </header>

        <section className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1.1fr_.9fr] lg:gap-16">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Rail or drive?</p>
            <h1 className="mt-4 max-w-2xl text-5xl font-black leading-[0.98] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
              Your Oʻahu commute, <span className="text-[var(--nalu-platinum-2)]">simplified.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              Nalu checks the trip conditions and helps you decide what to take and when to leave — without making you piece together several apps.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/"
                className="liquid-primary-action inline-flex min-h-12 items-center justify-center rounded-2xl px-6 text-sm font-bold"
              >
                Continue free
              </Link>
              <a
                href="#account"
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-6 text-sm font-bold text-foreground backdrop-blur-xl transition hover:bg-white/[0.07]"
              >
                Create a free account
              </a>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">No payment required. You can use Nalu as a guest.</p>
          </div>

          <div className="space-y-4">
            <div className="liquid-titanium-slab rounded-[28px] p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Nalu says</p>
                  <p className="mt-2 text-3xl font-black tracking-tight">Choose your commute.</p>
                </div>
                <HonuMark />
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs text-muted-foreground">Drive</p>
                  <p className="mt-2 text-xl font-bold">Live traffic</p>
                  <p className="mt-1 text-xs text-muted-foreground">Incidents + conditions</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs text-muted-foreground">Transit</p>
                  <p className="mt-2 text-xl font-bold">Skyline + TheBus</p>
                  <p className="mt-1 text-xs text-muted-foreground">Current trip options</p>
                </div>
              </div>
              <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3">
                <p className="text-sm font-semibold">Arrive By planning</p>
                <p className="mt-1 text-xs text-muted-foreground">Tell Nalu when you need to arrive, and it helps plan when to leave.</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
              <div className="rounded-xl border border-white/8 bg-white/[0.025] px-2 py-3">Live conditions</div>
              <div className="rounded-xl border border-white/8 bg-white/[0.025] px-2 py-3">Saved places</div>
              <div className="rounded-xl border border-white/8 bg-white/[0.025] px-2 py-3">Arrive on time</div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 border-t border-white/10 py-10 lg:grid-cols-2" aria-labelledby="how-nalu-works">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">How Nalu works</p>
            <h2 id="how-nalu-works" className="mt-2 text-2xl font-black tracking-tight">One commute decision, built from the pieces that matter.</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              Nalu is focused on Oʻahu commuting rather than trying to replace every map app. It brings driving, Skyline, and TheBus information into one trip view so you can compare the practical trip instead of checking several apps yourself.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
              <p className="text-sm font-semibold">Drive</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Current traffic, incidents, and road conditions can affect the drive.</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
              <p className="text-sm font-semibold">Transit</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Skyline and TheBus options can be considered alongside the rest of the trip.</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
              <p className="text-sm font-semibold">Arrive By</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Start with when you need to arrive and work backward to a departure plan.</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
              <p className="text-sm font-semibold">Saved places</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Save frequent destinations such as Home and Work for faster planning.</p>
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 py-10" aria-labelledby="faq">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Common questions</p>
          <h2 id="faq" className="mt-2 text-2xl font-black tracking-tight">What is Nalu?</h2>
          <div className="mt-6 grid gap-3">
            <details className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
              <summary className="cursor-pointer text-sm font-semibold">Does Nalu replace Google Maps or Apple Maps?</summary>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">No. Nalu is built around the specific Oʻahu commute decision: whether driving or transit makes sense for your trip and when you should leave.</p>
            </details>
            <details className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
              <summary className="cursor-pointer text-sm font-semibold">Does Nalu use live information?</summary>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">Nalu combines available current information for traffic, incidents, transit, weather, and other commute conditions. Availability and freshness can vary by source and location.</p>
            </details>
            <details className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
              <summary className="cursor-pointer text-sm font-semibold">Can Nalu tell me when to leave for work?</summary>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">Yes. Arrive By planning is designed to work backward from the time you need to arrive, using the trip information available at planning time.</p>
            </details>
            <details className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
              <summary className="cursor-pointer text-sm font-semibold">How accurate are Nalu's commute estimates?</summary>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">Estimates depend on the underlying traffic, transit, weather, and incident information available at the time. Real-world conditions can change, so Nalu does not guarantee an arrival time.</p>
            </details>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6" aria-labelledby="trust">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Trust & data</p>
          <h2 id="trust" className="mt-2 text-xl font-black tracking-tight">Useful information, not a promise of the future.</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            Commute information can change because of traffic, incidents, transit operations, weather, road conditions, and other real-world events. Nalu is a decision-support tool and does not guarantee route availability or arrival times. Always use your judgment and follow applicable traffic and transit rules.
          </p>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Nalu may use information from third-party traffic, transit, weather, and air-quality services. Their availability, timing, and accuracy can vary.
          </p>
        </section>

        <section id="account" className="grid gap-6 border-t border-white/10 pt-8 lg:grid-cols-[1fr_1.1fr] lg:items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Free account</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight">Make Nalu yours.</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Save Home and Work, keep your places across devices, and make future Nalu features available to your account.
            </p>
            <div className="mt-5 rounded-2xl border border-white/8 bg-white/[0.025] p-4">
              <p className="text-sm font-semibold">Premium is coming later.</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                We will only put features behind Premium when they provide clear extra value. Nothing here requires a payment today.
              </p>
            </div>
          </div>
          <div className="liquid-titanium-slab rounded-[24px] p-5 sm:p-6">
            <AccountSection compact />
          </div>
        </section>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-5 text-xs text-muted-foreground">
          <span>Built for Oʻahu commuters.</span>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <Link to="/oahu-commute" className="hover:text-foreground">Oʻahu commute guide</Link>
            <Link to="/" className="hover:text-foreground">Open Nalu</Link>
          </div>
        </footer>
      </div>
    </main>
  );
}

import { ClientOnly, Link, createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { AccountSection } from "@/components/account/AccountSection";
import { LegalFooter } from "@/components/LegalFooter";
import { naluPulseTagline } from "@/lib/nalu-voice";

const LiveNavMap = lazy(() => import("@/components/commute/LiveNavMap"));

const SITE_URL = "https://ridewithnalu.lovable.app";

const WELCOME_NAV_ROUTE = [
  { lat: 21.3335, lon: -158.055 },
  { lat: 21.348, lon: -158.030 },
  { lat: 21.367, lon: -158.010 },
  { lat: 21.386, lon: -157.995 },
  { lat: 21.395, lon: -157.970 },
  { lat: 21.390, lon: -157.940 },
  { lat: 21.375, lon: -157.910 },
  { lat: 21.350, lon: -157.885 },
  { lat: 21.325, lon: -157.865 },
];

function WelcomeNavigationPreview() {
  return (
    <div className="overflow-hidden rounded-[22px] border border-white/10 bg-black/30">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Turn-by-turn</p>
          <p className="mt-1 text-lg font-black tracking-tight">Driving to Work</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
          Navigation
        </span>
      </div>
      <div className="relative overflow-hidden bg-black">
        <img
          src="data:image/webp;base64,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"
          alt="Nalu live turn-by-turn navigation preview"
          className="block h-auto max-h-[585px] w-full object-contain object-top"
          loading="lazy"
          decoding="async"
        />
      </div>
    </div>
  );
}

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
          "Nalu brings the important pieces of the Oʻahu commute together, so you know your options and when to leave.",
      },
      { name: "robots", content: "index,follow,max-image-preview:large" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Nalu | Your Oʻahu commute, simplified" },
      {
        property: "og:description",
        content: "Check current traffic and your available options, then know when to leave.",
      },
      { property: "og:url", content: SITE_URL + "/welcome" },
      { property: "og:site_name", content: "Nalu" },
      { name: "twitter:title", content: "Nalu | Your Oʻahu commute, simplified" },
      {
        name: "twitter:description",
        content: "Check current traffic and your available options, then know when to leave.",
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
              description: "A commute decision app that helps people compare their available options and plan when to leave.",
            },
            {
              "@type": "Organization",
              "@id": SITE_URL + "/#organization",
              name: "Nalu",
              url: SITE_URL,
              description: "Nalu is an Oʻahu-focused commute decision tool that brings current commute information into one decision.",
            },
            {
              "@type": "SoftwareApplication",
              "@id": SITE_URL + "/#app",
              name: "Nalu",
              url: SITE_URL,
              description: "Nalu helps Oʻahu commuters compare their available options, check current commute conditions, and plan when to leave.",
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
  const markWelcomeSeen = () => {
    try {
      window.localStorage.setItem("nalu-welcome-seen-v1", "1");
    } catch {
      /* private mode: gate treats unreadable storage as seen */
    }
  };

  useEffect(() => {
    markWelcomeSeen();
  }, []);

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(105,183,245,.14),transparent_32%),radial-gradient(circle_at_85%_65%,rgba(104,211,161,.08),transparent_30%)]" />
      <div className="pointer-events-none absolute -right-28 top-20 size-72 rounded-full border border-white/[0.04]" />
      <div className="pointer-events-none absolute -left-36 bottom-10 size-80 rounded-full border border-white/[0.035]" />

      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-5xl flex-col px-5 pb-8 pt-7 sm:px-8 sm:pt-10">
        <header className="flex items-center justify-between">
          <Link to="/" onClick={markWelcomeSeen} className="flex items-center gap-3" aria-label="Open Nalu">
            <HonuMark />
            <div>
              <p className="text-lg font-black tracking-tight">Nalu</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Oʻahu commute</p>
            </div>
          </Link>
          <Link
            to="/"
            onClick={markWelcomeSeen}
            className="rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 text-sm font-semibold text-muted-foreground backdrop-blur-xl transition hover:border-white/20 hover:text-foreground"
          >
            Browse
          </Link>
        </header>

        <section className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1.1fr_.9fr] lg:gap-16">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Your commute. Figured out.</p>
            <h1 className="mt-4 max-w-2xl text-5xl font-black leading-[0.98] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
              Your commute, <span className="text-[var(--nalu-platinum-2)]">figured out.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              Nalu brings the important pieces of your Oʻahu commute together, so you know your options and when to leave.
            </p>
            <p className="mt-3 text-sm font-medium text-foreground/90">
              {naluPulseTagline("morning")}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/"
                onClick={markWelcomeSeen}
                className="liquid-primary-action inline-flex min-h-12 items-center justify-center rounded-2xl px-6 text-sm font-bold"
              >
                Start planning
              </Link>
              <a
                href="#account"
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-6 text-sm font-bold text-foreground backdrop-blur-xl transition hover:bg-white/[0.07]"
              >
                Create a free account
              </a>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Start as a guest. No payment required.</p>
          </div>

          <div className="space-y-4">
            <div className="liquid-titanium-slab rounded-[28px] p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Nalu says</p>
                  <p className="mt-2 text-3xl font-black tracking-tight">Here’s your commute.</p>
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
                  <p className="text-xs text-muted-foreground">Your options</p>
                  <p className="mt-2 text-xl font-bold">Bus or rail options</p>
                  <p className="mt-1 text-xs text-muted-foreground">Current trip options</p>
                </div>
              </div>
              <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3">
                <p className="text-sm font-semibold">Arrive By planning</p>
                <p className="mt-1 text-xs text-muted-foreground">Tell Nalu what time you need to arrive, and it tells you when to leave.</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
              <div className="rounded-xl border border-white/8 bg-white/[0.025] px-2 py-3">Live conditions</div>
              <div className="rounded-xl border border-white/8 bg-white/[0.025] px-2 py-3">Saved places</div>
              <div className="rounded-xl border border-white/8 bg-white/[0.025] px-2 py-3">Know when to leave</div>
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 py-12" aria-labelledby="ask-nalu-welcome">
          <div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Meet Nalu</p>
              <h2 id="ask-nalu-welcome" className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                You don’t have to figure out the commute yourself.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                Pick a destination, set an arrival time if you need one, and Nalu brings the important commute information together for you.
              </p>
            </div>

            <div className="liquid-titanium-slab rounded-[24px] p-4 sm:p-5" aria-label="Plan your trip product preview">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Plan your trip</p>
                  <p className="text-sm font-semibold">Start with where you’re going.</p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs text-muted-foreground">You</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  “I need to be downtown by 8.”
                </p>
              </div>

              <div className="mt-3 rounded-2xl border border-primary/20 bg-primary/[0.07] p-4">
                <p className="text-xs font-semibold text-primary">Nalu</p>
                <p className="mt-1 text-sm font-semibold text-foreground">I’ll compare what’s available now and work out when to leave.</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] text-muted-foreground">
                  <span className="rounded-lg border border-white/8 bg-white/[0.025] px-2 py-2">Traffic</span>
                  <span className="rounded-lg border border-white/8 bg-white/[0.025] px-2 py-2">Options</span>
                  <span className="rounded-lg border border-white/8 bg-white/[0.025] px-2 py-2">Timing</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 py-10" aria-labelledby="see-nalu-live">
          <div className="grid gap-6 lg:grid-cols-[.85fr_1.15fr] lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">See Nalu in action</p>
              <h2 id="see-nalu-live" className="mt-2 text-2xl font-black tracking-tight">One live commute view. Less guesswork.</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                Tap a destination and Nalu opens your commute view with current traffic, transit options, roadwork, timing, and the drive-or-transit decision in one place.
              </p>
              <p className="mt-3 text-xs text-muted-foreground">The example below is a product preview, not live trip data.</p>
            </div>
            <div className="liquid-titanium-slab rounded-[24px] p-4 sm:p-5" aria-label="Nalu commute page preview">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Commute</p>
                  <p className="mt-1 text-lg font-black tracking-tight">Work · Downtown</p>
                </div>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-bold text-emerald-300">Live</span>
              </div>
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Nalu says</p>
                    <p className="mt-1 text-2xl font-black tracking-tight">Drive</p>
                  </div>
                  <p className="text-sm font-bold">42–49 min</p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-[72%] rounded-full bg-primary" />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Traffic is moving slower than usual on your route.</p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                  <p className="text-[11px] text-muted-foreground">Your options</p>
                  <p className="mt-1 text-sm font-bold">55 min</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Bus or rail options</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                  <p className="text-[11px] text-muted-foreground">Leave by</p>
                  <p className="mt-1 text-sm font-bold">6:48 AM</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Arrive By 7:45 AM</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 py-10" aria-labelledby="turn-by-turn">
          <div className="grid gap-6 lg:grid-cols-[.85fr_1.15fr] lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Need directions?</p>
              <h2 id="turn-by-turn" className="mt-2 text-2xl font-black tracking-tight">Going by car? Nalu can take you there.</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                If you choose to drive, Nalu can continue with turn-by-turn directions, live traffic updates, and rerouting when conditions change.
              </p>
              <p className="mt-3 text-xs text-muted-foreground">Navigation is available when you choose to drive.</p>
            </div>
            <div className="liquid-titanium-slab rounded-[24px] p-2 sm:p-3" aria-label="Nalu turn-by-turn navigation preview">
              <WelcomeNavigationPreview />
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 py-10" aria-labelledby="watching-nalu">
          <div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Nalu is watching</p>
              <h2 id="watching-nalu" className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">The commute changes. Nalu keeps checking.</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Nalu looks at the current information that can affect your trip, so your decision is based on what is happening now.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"><p className="text-sm font-semibold">Traffic</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Live drive conditions and changing travel times.</p></div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"><p className="text-sm font-semibold">Roadwork</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Planned closures and lane restrictions when available.</p></div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"><p className="text-sm font-semibold">Your options</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Rail, bus, walking connections, and combinations when available.</p></div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"><p className="text-sm font-semibold">Conditions</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Weather and other available commute information.</p></div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 border-t border-white/10 py-10 lg:grid-cols-2" aria-labelledby="how-nalu-works">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">How Nalu works</p>
            <h2 id="how-nalu-works" className="mt-2 text-2xl font-black tracking-tight">One place for the commute ahead.</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              Nalu brings the important pieces together, so you can make one commute decision instead of checking several apps.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
              <p className="text-sm font-semibold">Drive</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Current traffic, incidents, and road conditions can affect the drive.</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
              <p className="text-sm font-semibold">Your options</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Bus, rail, walking connections, and combinations can be considered when available.</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
              <p className="text-sm font-semibold">Arrive By</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Tell Nalu what time you need to arrive. Nalu figures out when you should leave.</p>
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
              <p className="mt-3 text-sm leading-6 text-muted-foreground">No. Nalu is focused on the commute decision: whether driving or another available option makes sense for your trip and when you should leave. It starts with Oʻahu, where we’re building around real local commute needs.</p>
            </details>
            <details className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
              <summary className="cursor-pointer text-sm font-semibold">Does Nalu use live information?</summary>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">Nalu combines available current information for traffic, incidents, transit, weather, and other commute conditions. Availability and freshness can vary by source and location.</p>
            </details>
            <details className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
              <summary className="cursor-pointer text-sm font-semibold">Can Nalu tell me when to leave for work?</summary>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">Yes. Arrive By planning uses the time you need to arrive to tell you when you should leave.</p>
            </details>
            <details className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
              <summary className="cursor-pointer text-sm font-semibold">How accurate are Nalu's commute estimates?</summary>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">Estimates depend on the underlying traffic, transit, weather, and incident information available at the time. Real-world conditions can change, so Nalu does not guarantee an arrival time.</p>
            </details>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6" aria-labelledby="trust">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Trust & data</p>
          <h2 id="trust" className="mt-2 text-xl font-black tracking-tight">Current information. Real-world conditions can still change.</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            Traffic, transit, roadwork, incidents, weather, and other conditions can change. Nalu uses the information available at planning time to help you make a commute decision, but it cannot guarantee an arrival time.
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
            
          </div>
          <div className="liquid-titanium-slab rounded-[24px] p-5 sm:p-6">
            <AccountSection compact />
          </div>
        </section>

        <LegalFooter />
      </div>
    </main>
  );
}

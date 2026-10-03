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
          src="/nalu-live-navigation.svg"
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

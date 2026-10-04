import { ClientOnly, Link, createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { AccountSection } from "@/components/account/AccountSection";
import { LegalFooter } from "@/components/LegalFooter";
import { SITE_URL } from "@/lib/site";

const LiveNavMap = lazy(() => import("@/components/commute/LiveNavMap"));

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

/** The app icon itself, so the welcome page matches the home-screen icon. */
function HonuMark() {
  return (
    <img
      src="/icons/nalu-icon.svg"
      alt=""
      aria-hidden="true"
      className="size-14 rounded-[22%] shadow-[0_12px_32px_rgba(0,0,0,.35)]"
    />
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
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Oʻahu commute</p>
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

        <section className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.1fr_.9fr] lg:gap-16">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">Drive · Bus · Skyline</p>
            <h1 className="mt-4 max-w-2xl text-5xl font-black leading-[0.98] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
              Your commute, <span className="text-[var(--nalu-platinum-2)]">figured out.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
              Tell Nalu where you’re going. It checks traffic, TheBus and Skyline, then tells you
              the fastest way and when to leave.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/"
                onClick={markWelcomeSeen}
                className="liquid-primary-action inline-flex min-h-14 items-center justify-center rounded-2xl px-6 text-base font-bold"
              >
                Start planning
              </Link>
              <a
                href="#account"
                className="inline-flex min-h-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-6 text-base font-bold text-foreground backdrop-blur-xl transition hover:bg-white/[0.07]"
              >
                Create a free account
              </a>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Free. No account needed to start.
            </p>
          </div>

          <div
            className="liquid-titanium-slab rounded-[24px] p-5 sm:p-6"
            aria-label="Example of a Nalu answer"
          >
            <p className="text-sm text-muted-foreground">Example · Ewa Beach to Downtown</p>
            <p className="mt-2 text-sm font-semibold text-recommended">Nalu says</p>
            <p className="mt-1 text-3xl font-black tracking-tight">Drive · 12 min faster</p>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <p className="text-sm text-muted-foreground">Leave</p>
                <p className="mt-1 text-xl font-bold text-recommended">6:40</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <p className="text-sm text-muted-foreground">Arrive</p>
                <p className="mt-1 text-xl font-bold">7:38</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <p className="text-sm text-muted-foreground">Driving</p>
                <p className="mt-1 text-xl font-bold">48 min</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Arrival includes parking. The bus would get you there at 7:50.
            </p>
          </div>
        </section>

        <section className="border-t border-white/10 py-10" aria-labelledby="how-nalu-works">
          <h2 id="how-nalu-works" className="text-3xl font-black tracking-tight">How it works</h2>
          <ol className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              ["Tap “Where to?”", "Type the place you’re going. Nalu uses where you are now as the start."],
              ["Nalu compares", "Live traffic for driving, and the TheBus and Skyline timetable for transit."],
              ["Go", "You get one answer: drive or take transit, when to leave, and when you’ll arrive."],
            ].map(([title, body], index) => (
              <li key={title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="flex items-center gap-3 text-lg font-bold">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-base font-black text-primary-foreground">
                    {index + 1}
                  </span>
                  {title}
                </p>
                <p className="mt-2 text-base leading-7 text-muted-foreground">{body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-5 text-base leading-7 text-muted-foreground">
            Need to be somewhere at a set time? Tap <span className="font-semibold text-foreground">Arrive by</span>{" "}
            and Nalu tells you when to leave. Driving? Nalu can give you turn-by-turn directions.
          </p>
        </section>

        <section className="border-t border-white/10 py-10" aria-labelledby="faq">
          <h2 id="faq" className="text-3xl font-black tracking-tight">Questions</h2>
          <div className="mt-6 grid gap-3">
            <details className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <summary className="flex min-h-12 cursor-pointer items-center py-2 text-base font-semibold">Does Nalu replace Google Maps or Apple Maps?</summary>
              <p className="mt-3 text-base leading-7 text-muted-foreground">No. Nalu answers one question: is it faster to drive or take TheBus or Skyline right now, and when should you leave. It’s built for Oʻahu.</p>
            </details>
            <details className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <summary className="flex min-h-12 cursor-pointer items-center py-2 text-base font-semibold">Where does the information come from?</summary>
              <p className="mt-3 text-base leading-7 text-muted-foreground">Driving times come from live traffic (TomTom). Bus and Skyline times come from TheBus’s official timetable. Weather comes from the National Weather Service.</p>
            </details>
            <details className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <summary className="flex min-h-12 cursor-pointer items-center py-2 text-base font-semibold">How accurate is it?</summary>
              <p className="mt-3 text-base leading-7 text-muted-foreground">Nalu uses the latest information it can get, but traffic and buses can change after you leave. Treat the times as a strong guide, not a guarantee.</p>
            </details>
          </div>
        </section>

        <section id="account" className="grid gap-6 border-t border-white/10 pt-8 lg:grid-cols-[1fr_1.1fr] lg:items-start">
          <div>
            <h2 className="text-3xl font-black tracking-tight">Free account</h2>
            <p className="mt-2 max-w-md text-base leading-7 text-muted-foreground">
              Save Home and Work so they’re one tap away, on any phone you sign in on.
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

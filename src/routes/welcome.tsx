import { Link, createFileRoute } from "@tanstack/react-router";
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
    ],
    links: [{ rel: "canonical", href: SITE_URL + "/welcome" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "Nalu welcome page",
          url: SITE_URL + "/welcome",
          description: "The entry experience for Nalu, an Oʻahu commute decision app.",
          isPartOf: { "@type": "WebSite", name: "Nalu", url: SITE_URL },
        }),
      },
    ],
  }),
  component: WelcomePage,
});

function WelcomePage() {
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
                <p className="mt-1 text-xs text-muted-foreground">Work backward from the time you need to arrive.</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
              <div className="rounded-xl border border-white/8 bg-white/[0.025] px-2 py-3">Live conditions</div>
              <div className="rounded-xl border border-white/8 bg-white/[0.025] px-2 py-3">Saved places</div>
              <div className="rounded-xl border border-white/8 bg-white/[0.025] px-2 py-3">Arrive on time</div>
            </div>
          </div>
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
          <div className="flex gap-4">
            <Link to="/oahu-commute" className="hover:text-foreground">Oʻahu commute guide</Link>
            <Link to="/" className="hover:text-foreground">Open Nalu</Link>
          </div>
        </footer>
      </div>
    </main>
  );
}

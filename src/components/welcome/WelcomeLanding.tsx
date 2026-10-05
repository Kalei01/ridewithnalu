import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { Tagline } from "@/components/brand/Tagline";
import { AccountSection } from "@/components/account/AccountSection";
import { LegalFooter } from "@/components/LegalFooter";
import { introductionHidden, markWelcomeSeen } from "@/lib/welcome-seen";

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

/** Public pages linked from the introduction, so people and search engines can find them. */
const PLAN_AHEAD_LINKS = [
  ["/guides", "All commute guides", "Kapolei, ʻEwa Beach and Mililani to town, the airport, UH Mānoa and late nights."],
  ["/guides/skyline-rail-guide", "Skyline rail guide", "Hours, stations, fares and the bus connections at each station."],
  ["/roadwork", "Roadwork this week", "Planned freeway and highway lane closures from HDOT, checked through the day."],
] as const;

/**
 * Nalu's public introduction. "/" shows it on a first signed-out visit (and to
 * search engines); /welcome shows it on request. `onStart` lets "/" switch to
 * the app in place when someone taps Start planning.
 */
export function WelcomeLanding({
  onStart,
  markSeenOnMount = true,
}: {
  onStart?: () => void;
  /** "/" passes false: its gate decides first, then marks it seen. */
  markSeenOnMount?: boolean;
}) {
  const start = () => {
    markWelcomeSeen();
    onStart?.();
  };

  // Seen once it has actually been shown.
  useEffect(() => {
    if (markSeenOnMount && !introductionHidden()) markWelcomeSeen();
  }, [markSeenOnMount]);

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(105,183,245,.14),transparent_32%),radial-gradient(circle_at_85%_65%,rgba(104,211,161,.08),transparent_30%)]" />
      <div className="pointer-events-none absolute -right-28 top-20 size-72 rounded-full border border-white/[0.04]" />
      <div className="pointer-events-none absolute -left-36 bottom-10 size-80 rounded-full border border-white/[0.035]" />

      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-5xl flex-col px-5 pb-8 pt-7 sm:px-8 sm:pt-10">
        <header className="flex items-center justify-between">
          <Link to="/" onClick={start} className="flex items-center gap-3" aria-label="Open Nalu">
            <HonuMark />
            <div>
              <p className="text-lg font-black tracking-tight">Nalu</p>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Oʻahu commute</p>
            </div>
          </Link>
          <Link
            to="/"
            onClick={start}
            className="inline-flex min-h-11 items-center rounded-full border border-white/10 bg-white/[0.035] px-4 text-sm font-semibold text-muted-foreground backdrop-blur-xl transition hover:border-white/20 hover:text-foreground"
          >
            Browse
          </Link>
        </header>

        <section className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.1fr_.9fr] lg:gap-16">
          <div>
            <Tagline size="md" />
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
                onClick={start}
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
              Free. No account needed to start.{" "}
              <Link to="/install" className="font-semibold text-primary underline-offset-4 hover:underline">
                Install it on your phone
              </Link>
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
                <p className="mt-1 whitespace-nowrap text-lg font-bold text-recommended">6:40</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <p className="text-sm text-muted-foreground">Arrive</p>
                <p className="mt-1 whitespace-nowrap text-lg font-bold">7:38</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <p className="text-sm text-muted-foreground">Driving</p>
                <p className="mt-1 whitespace-nowrap text-lg font-bold">48 min</p>
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
          <ul className="mt-5 grid gap-2 text-base leading-7 text-muted-foreground">
            <li>
              <span className="font-semibold text-foreground">Time-to-leave alerts:</span> one
              notification when it's time to go, morning or evening.
            </li>
            <li>
              <span className="font-semibold text-foreground">Your bus, live:</span> see where it is on
              the map and how far it is from your stop.
            </li>
            <li>
              <span className="font-semibold text-foreground">Arrive by:</span> tell Nalu when you need
              to be there; it tells you when to leave. Driving? Turn-by-turn directions too.
            </li>
          </ul>
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
              <summary className="flex min-h-12 cursor-pointer items-center py-2 text-base font-semibold">Is Nalu free?</summary>
              <p className="mt-3 text-base leading-7 text-muted-foreground">Yes. No account is needed to check a trip. A free account saves your places and turns on alerts. Getting home safe will always be free.</p>
            </details>
            <details className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <summary className="flex min-h-12 cursor-pointer items-center py-2 text-base font-semibold">How accurate is it?</summary>
              <p className="mt-3 text-base leading-7 text-muted-foreground">Nalu uses the latest information it can get, but traffic and buses can change after you leave. Treat the times as a strong guide, not a guarantee.</p>
            </details>
          </div>
        </section>

        <nav className="border-t border-white/10 py-10" aria-labelledby="plan-ahead">
          <h2 id="plan-ahead" className="text-3xl font-black tracking-tight">Plan ahead</h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {PLAN_AHEAD_LINKS.map(([to, title, body]) => (
              <li key={to}>
                <Link
                  to={to}
                  className="flex h-full items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/20"
                >
                  <span className="min-w-0 flex-1">
                    <span className="text-lg font-bold text-primary">{title}</span>
                    <span className="mt-1 block text-base leading-7 text-muted-foreground">{body}</span>
                  </span>
                  <ChevronRight aria-hidden="true" className="mt-1 size-5 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>

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

        <LegalFooter onOpen={onStart} />
      </div>
    </main>
  );
}

import { Link } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import {
  BellRing,
  Bus,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Construction,
  MapPin,
  Navigation,
  Plane,
  TrainFront,
} from "lucide-react";
import { AccountSection } from "@/components/account/AccountSection";
import { LegalFooter } from "@/components/LegalFooter";
import { GUIDES, TRIP_GUIDES } from "@/components/guides/guides";
import {
  ALA_MOANA,
  DOWNTOWN,
  HNL_AIRPORT,
  UH_MANOA,
  WAIKIKI,
} from "@/components/guides/destinations";
import { useReveal } from "@/hooks/use-reveal";
import { introductionHidden, markWelcomeSeen } from "@/lib/welcome-seen";
import { LiveStrip } from "./LiveStrip";
import { plannerHref } from "@/lib/home/planner-link";
import { WhereToSearch } from "./WhereToSearch";
import { Waves } from "./Waves";
import "./home.css";

const LiveIsland = lazy(() => import("./LiveIsland"));

/** One-tap destinations: each opens the real planner with the trip started from where you are. */
const CHIPS = [
  { place: DOWNTOWN, label: "Downtown", icon: MapPin },
  { place: HNL_AIRPORT, label: "Airport", icon: Plane },
  { place: WAIKIKI, label: "Waikīkī", icon: MapPin },
  { place: ALA_MOANA, label: "Ala Moana", icon: MapPin },
  { place: UH_MANOA, label: "UH Mānoa", icon: MapPin },
] as const;

const FEATURES = [
  { icon: BellRing, title: "Time-to-leave alerts", body: "One nudge when it’s time to go." },
  { icon: Bus, title: "Your bus, live", body: "Where it is and how far from your stop." },
  { icon: CalendarClock, title: "Arrive by", body: "Say when; Nalu says when to leave." },
  { icon: Construction, title: "Roadwork", body: "HDOT lane closures on your route." },
] as const;

const FAQ = [
  [
    "Does Nalu replace Google Maps or Apple Maps?",
    "No. Nalu answers one question: is it faster to drive or take TheBus or Skyline right now, and when should you leave. It’s built for Oʻahu.",
  ],
  [
    "Where does the information come from?",
    "Driving times come from live traffic (TomTom). Bus and Skyline times come from TheBus’s official timetable. Weather comes from the National Weather Service.",
  ],
  [
    "Is Nalu free?",
    "Yes. No account is needed to check a trip. A free account saves your places and turns on alerts. Getting home safe will always be free.",
  ],
  [
    "How accurate is it?",
    "Nalu uses the latest information it can get, but traffic and buses can change after you leave. Treat the times as a strong guide, not a guarantee.",
  ],
] as const;

const PLAN_AHEAD_LINKS = [
  [
    "/guides",
    "All commute guides",
    "Kapolei, ʻEwa Beach and Mililani to town, the airport, UH Mānoa and late nights.",
  ],
  [
    "/guides/skyline-rail-guide",
    "Skyline rail guide",
    "Hours, stations, fares and the bus connections at each station.",
  ],
  [
    "/roadwork",
    "Roadwork this week",
    "Planned freeway and highway lane closures from HDOT, checked through the day.",
  ],
] as const;

/** The live island loads only as it scrolls near, keeping the first screen light. */
function IslandSection() {
  const holder = useRef<HTMLDivElement | null>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShow(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShow(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const placeholder = (
    <div>
      <div className="nh-island-card nh-island-placeholder" />
      <div className="mt-3 h-5" />
      <div className="mt-5 nh-card h-[5.5rem]" />
    </div>
  );
  return (
    <section aria-labelledby="live-island" className="pb-8 pt-4">
      <h2 id="live-island" className="text-2xl font-black tracking-tight">
        Oʻahu, live
      </h2>
      <p className="mt-1 text-base leading-6 text-muted-foreground">
        Skyline trains where the timetable puts them; the drive into town from a live traffic check.
      </p>
      <div ref={holder} className="mt-4">
        {show ? (
          <Suspense fallback={placeholder}>
            <LiveIsland />
          </Suspense>
        ) : (
          placeholder
        )}
      </div>
    </section>
  );
}

function HowItWorks() {
  const ref = useReveal<HTMLOListElement>(0.35);
  return (
    <section aria-labelledby="how-nalu-works" className="py-6">
      <h2 id="how-nalu-works" className="text-2xl font-black tracking-tight">
        How it works
      </h2>
      <ol ref={ref} className="nh-rail-scroll mt-4 pb-1">
        <li className="nh-card nh-swipe-card p-4">
          <div className="nh-demo flex items-center gap-2 px-3 text-lg font-bold">
            <Navigation aria-hidden="true" className="size-5 text-[var(--nh-car)]" />
            <span className="nh-typed">Ala Moana</span>
          </div>
          <p className="mt-3 text-lg font-bold">1. Say where</p>
          <p className="mt-1 text-base leading-6 text-muted-foreground">
            Type a place. Nalu starts from where you are now.
          </p>
        </li>
        <li className="nh-card nh-swipe-card p-4">
          <div className="nh-demo grid content-center gap-2 px-3">
            {(["var(--nh-car)", "var(--nh-rail)", "var(--nh-bus)"] as const).map((color, i) => (
              <div key={color} className="nh-bar" style={{ width: `${[92, 70, 80][i]}%` }}>
                <span style={{ background: color }} />
              </div>
            ))}
          </div>
          <p className="mt-3 text-lg font-bold">2. Nalu compares</p>
          <p className="mt-1 text-base leading-6 text-muted-foreground">
            Driving with live traffic, Skyline (with a car to the station or not) and TheBus.
          </p>
        </li>
        <li className="nh-card nh-swipe-card p-4">
          <div className="nh-demo flex items-center px-3">
            <span className="nh-go inline-flex items-center gap-2 rounded-full bg-[var(--color-recommended)]/15 px-3 py-1.5 text-base font-bold text-[var(--color-recommended)]">
              <TrainFront aria-hidden="true" className="size-4" />
              Leave by 7:42
            </span>
          </div>
          <p className="mt-3 text-lg font-bold">3. Go</p>
          <p className="mt-1 text-base leading-6 text-muted-foreground">
            One answer and when to leave, with the other ways right below it.
          </p>
        </li>
      </ol>
    </section>
  );
}

/**
 * Nalu's new public home page (preview at /home-preview until Josh approves
 * it for "/"). The app first: a big "Where to?" box and one-tap places, then
 * what's happening on Oʻahu right now, the live island and the race demo.
 * Everything a search engine needs (the h1, FAQ text, guide links) is
 * server-rendered; the live parts load after.
 */
export function HomeLanding({
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
  useEffect(() => {
    if (markSeenOnMount && !introductionHidden()) markWelcomeSeen();
  }, [markSeenOnMount]);
  const searchRef = useRef<HTMLInputElement | null>(null);

  return (
    <main className="nh min-h-[100dvh] overflow-x-clip text-foreground">
      <div className="nh-hero">
        <Waves />
        <div className="mx-auto w-full max-w-3xl px-5 pb-6 pt-5 sm:px-8">
          <div className="flex items-center justify-between">
            <Link
              to="/"
              onClick={start}
              className="flex items-center gap-2.5"
              aria-label="Open Nalu"
            >
              <img
                src="/icons/nalu-icon.svg"
                alt=""
                aria-hidden="true"
                width={40}
                height={40}
                className="size-10 rounded-[22%] shadow-[0_8px_24px_rgba(0,0,0,.35)]"
              />
              <span className="text-lg font-black tracking-tight">Nalu</span>
            </Link>
            <Link
              to="/"
              onClick={start}
              className="inline-flex min-h-11 items-center rounded-full border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
            >
              Open the app
            </Link>
          </div>

          <h1 className="mt-8 text-[2.6rem] font-black leading-[1.02] tracking-[-0.04em] sm:text-6xl">
            Your Oʻahu commute, <span className="text-[var(--nalu-platinum-2)]">figured out.</span>
          </h1>
          <p className="mt-3 text-lg leading-7 text-muted-foreground">
            Drive, TheBus or Skyline? Nalu checks live traffic and the timetable, then tells you the
            fastest way and when to leave.
          </p>

          <div className="mt-6">
            <WhereToSearch inputRef={searchRef} />
          </div>
          <nav aria-label="Popular places" className="nh-rail-scroll mt-3">
            {CHIPS.map(({ place, label, icon: Icon }) => (
              <a
                key={label}
                href={plannerHref(place)}
                onClick={markWelcomeSeen}
                className="nh-chip"
              >
                <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
                {label}
              </a>
            ))}
          </nav>
          <p className="mt-2 text-sm text-muted-foreground">
            Free, no account needed.{" "}
            <Link
              to="/install"
              className="inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline"
            >
              Put it on your phone
            </Link>
          </p>

          <LiveStrip />
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl px-5 sm:px-8">
        <IslandSection />

        <div className="border-t border-white/10">
          <HowItWorks />
        </div>

        <section aria-labelledby="features" className="border-t border-white/10 py-6">
          <h2 id="features" className="text-2xl font-black tracking-tight">
            Also in Nalu
          </h2>
          <ul className="nh-rail-scroll mt-3 pb-1">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="nh-card w-[11.5rem] shrink-0 p-3">
                <Icon aria-hidden="true" className="size-5 text-[var(--nh-car)]" />
                <p className="mt-2 text-base font-bold leading-5">{title}</p>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">{body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="faq" className="border-t border-white/10 py-6">
          <h2 id="faq" className="text-2xl font-black tracking-tight">
            Questions
          </h2>
          <div className="mt-3 grid gap-2">
            {FAQ.map(([question, answer]) => (
              <details key={question} className="nh-details nh-card px-4">
                <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 py-2 text-base font-semibold">
                  {question}
                  <ChevronDown
                    aria-hidden="true"
                    className="nh-chevron size-5 shrink-0 text-muted-foreground"
                  />
                </summary>
                <p className="pb-4 text-base leading-7 text-muted-foreground">{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <nav aria-labelledby="popular-commutes" className="border-t border-white/10 py-6">
          <details className="nh-details nh-card px-4">
            <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-3 py-2">
              <h2 id="popular-commutes" className="text-lg font-bold">
                Popular commutes
              </h2>
              <ChevronDown
                aria-hidden="true"
                className="nh-chevron size-5 shrink-0 text-muted-foreground"
              />
            </summary>
            <ul className="grid gap-1 pb-3">
              {TRIP_GUIDES.map((slug) => (
                <li key={slug}>
                  <Link
                    to={GUIDES[slug].path}
                    className="flex min-h-12 items-start gap-3 rounded-xl py-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-bold text-primary">
                        {GUIDES[slug].name}
                      </span>
                      <span className="block text-sm leading-6 text-muted-foreground">
                        {GUIDES[slug].summary}
                      </span>
                    </span>
                    <ChevronRight
                      aria-hidden="true"
                      className="mt-1 size-5 shrink-0 text-muted-foreground"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </details>
          <details className="nh-details nh-card mt-2 px-4">
            <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-3 py-2">
              <h2 id="plan-ahead" className="text-lg font-bold">
                Plan ahead
              </h2>
              <ChevronDown
                aria-hidden="true"
                className="nh-chevron size-5 shrink-0 text-muted-foreground"
              />
            </summary>
            <ul className="grid gap-1 pb-3">
              {PLAN_AHEAD_LINKS.map(([to, title, body]) => (
                <li key={to}>
                  <Link to={to} className="flex min-h-12 items-start gap-3 rounded-xl py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-bold text-primary">{title}</span>
                      <span className="block text-sm leading-6 text-muted-foreground">{body}</span>
                    </span>
                    <ChevronRight
                      aria-hidden="true"
                      className="mt-1 size-5 shrink-0 text-muted-foreground"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </details>
          <details id="account" className="nh-details nh-card mt-2 px-4">
            <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-3 py-2">
              <h2 className="text-lg font-bold">Free account</h2>
              <ChevronDown
                aria-hidden="true"
                className="nh-chevron size-5 shrink-0 text-muted-foreground"
              />
            </summary>
            <p className="text-base leading-7 text-muted-foreground">
              Save Home and Work so they’re one tap away, on any phone you sign in on.
            </p>
            <div className="py-4">
              <AccountSection compact />
            </div>
          </details>
        </nav>

        <div className="pb-8">
          <LegalFooter onOpen={onStart} />
        </div>
      </div>
    </main>
  );
}

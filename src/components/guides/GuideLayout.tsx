import type { ReactNode } from "react";
import { markWelcomeSeen } from "@/lib/welcome-seen";
import { tripHref, type GuideDestination } from "./destinations";
import { Link } from "@tanstack/react-router";
import { GUIDES, LAST_UPDATED, type GuideSlug } from "./guides";
import type { GuideFaq } from "./guide-head";

/**
 * Shared shell for the /guides pages: breadcrumbs, heading, a visible
 * "Last updated" line, the page body, visible FAQs (matching the FAQPage
 * JSON-LD), a clear link into the app, and related guides. Everything here
 * renders on the server; nothing is hidden behind client-only code.
 * Text stays at 16px or larger.
 */
export function GuideLayout({
  breadcrumb,
  eyebrow,
  title,
  intro,
  faqs,
  related,
  children,
  showHubCrumb = true,
  destination,
}: {
  breadcrumb: string;
  eyebrow?: string;
  title: string;
  /** The answer to the page's main question, in the first two sentences. */
  intro: ReactNode;
  faqs: GuideFaq[];
  related: GuideSlug[];
  children: ReactNode;
  showHubCrumb?: boolean;
  /** Where the "live answer" button starts a trip to, when the guide has one. */
  destination?: GuideDestination;
}) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-14">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base text-muted-foreground">
            <li>
              <Link to="/" className="underline-offset-4 hover:text-foreground hover:underline">
                Nalu
              </Link>
            </li>
            {showHubCrumb && (
              <>
                <li aria-hidden="true">/</li>
                <li>
                  <Link to="/guides" className="underline-offset-4 hover:text-foreground hover:underline">
                    Guides
                  </Link>
                </li>
              </>
            )}
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-foreground">
              {breadcrumb}
            </li>
          </ol>
        </nav>

        <header className="mt-8">
          <p className="text-base font-bold uppercase tracking-[0.14em] text-primary">
            {eyebrow ?? "Nalu guide · Oʻahu"}
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">{title}</h1>
          <div className="mt-5 text-lg leading-8 text-foreground/90">{intro}</div>
          <p className="mt-4 text-base text-muted-foreground">Last updated: {LAST_UPDATED}</p>
        </header>

        <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-10">{children}</div>

        <OpenNaluCta destination={destination} />

        {faqs.length > 0 && (
          <section className="mt-12" aria-labelledby="faq">
            <h2 id="faq" className="text-2xl font-bold">
              Common questions
            </h2>
            <div className="mt-4 grid gap-6">
              {faqs.map((item) => (
                <div key={item.q}>
                  <h3 className="text-lg font-semibold">{item.q}</h3>
                  <p className="mt-1 text-base leading-7 text-muted-foreground">{item.a}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {related.length > 0 && (
          <section className="mt-12" aria-labelledby="related">
            <h2 id="related" className="text-2xl font-bold">
              Related guides
            </h2>
            <ul className="mt-4 grid gap-3">
              {related.map((slug) => {
                const guide = GUIDES[slug];
                return (
                  <li key={slug}>
                    <Link
                      to={guide.path}
                      className="block rounded-2xl border border-border bg-card/60 p-4 transition-colors hover:bg-accent"
                    >
                      <span className="block text-lg font-semibold text-foreground">{guide.name}</span>
                      <span className="mt-1 block text-base leading-7 text-muted-foreground">{guide.summary}</span>
                    </Link>
                  </li>
                );
              })}
              <li>
                <Link
                  to="/guides"
                  className="inline-flex min-h-11 items-center text-base font-semibold text-primary underline-offset-4 hover:underline"
                >
                  All Oʻahu commute guides
                </Link>
              </li>
            </ul>
          </section>
        )}

        <GuideFooter />
      </div>
    </main>
  );
}

/**
 * The one call to action every guide carries. It goes straight to the planner
 * (never the introduction), with the guide's trip already started when the
 * guide has a clear destination.
 */
export function OpenNaluCta({ destination }: { destination?: GuideDestination | undefined }) {
  const className =
    "liquid-primary-action mt-5 inline-flex min-h-14 items-center justify-center rounded-2xl px-6 text-center text-base font-bold";
  return (
    <section className="mt-12 rounded-2xl border border-border bg-card/60 p-5 sm:p-6" aria-labelledby="open-nalu">
      <h2 id="open-nalu" className="text-xl font-bold">
        Get the live answer for your trip
      </h2>
      <p className="mt-2 text-base leading-7 text-muted-foreground">
        Nalu checks live traffic and TheBus and Skyline timetables for your exact trip, then tells you
        whether to drive or ride and when to leave. Free, no account needed.
      </p>
      {destination ? (
        <a href={tripHref(destination)} onClick={markWelcomeSeen} className={className}>
          Check your trip to {destination.name}
        </a>
      ) : (
        <Link to="/" onClick={markWelcomeSeen} className={className}>
          Open Nalu for your live answer
        </Link>
      )}
    </section>
  );
}

function GuideFooter() {
  const linkClass = "inline-flex min-h-11 items-center hover:text-foreground";
  return (
    <footer className="mt-12 border-t border-border pt-6 text-base text-muted-foreground">
      <nav aria-label="Site" className="flex flex-wrap gap-x-5 gap-y-1">
        <Link to="/" className={linkClass}>Open Nalu</Link>
        <Link to="/guides" className={linkClass}>Guides</Link>
        <Link to="/oahu-commute" className={linkClass}>Oʻahu commute guide</Link>
        <Link to="/install" className={linkClass}>Install</Link>
        <Link to="/privacy" className={linkClass}>Privacy</Link>
        <Link to="/terms" className={linkClass}>Terms</Link>
        <Link to="/disclaimer" className={linkClass}>Disclaimer</Link>
      </nav>
      <p className="mt-4">
        Times and fares are for general planning. Service can change; check thebus.org for current
        timetables and fares.
      </p>
    </footer>
  );
}

/** A guide section with a real h2. */
export function GuideSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-2xl font-bold">
        {title}
      </h2>
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-4 text-base leading-7 text-muted-foreground">{children}</div>
    </section>
  );
}

/** Bulleted list in guide body style. */
export function GuideList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="grid list-disc gap-2 pl-6">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

/** Simple responsive table; scrolls inside its own box on narrow phones. */
export function GuideTable({ caption, head, rows }: { caption: string; head: string[]; rows: ReactNode[][] }) {
  // The caption sits outside the scrolling box so it never gets clipped when a
  // wide table scrolls sideways on a phone.
  return (
    <figure className="rounded-2xl border border-border">
      <figcaption className="px-4 pt-3 text-base font-semibold text-foreground">{caption}</figcaption>
      <div className="overflow-x-auto">
      <table aria-label={caption} className="w-full min-w-[20rem] border-collapse text-left text-base">
        <thead>
          <tr className="border-b border-border">
            {head.map((cell) => (
              <th key={cell} scope="col" className="px-4 py-3 font-semibold text-foreground">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-border/60 last:border-0">
              {row.map((cell, cellIndex) =>
                cellIndex === 0 ? (
                  <th key={cellIndex} scope="row" className="px-4 py-3 align-top font-medium text-foreground">
                    {cell}
                  </th>
                ) : (
                  <td key={cellIndex} className="px-4 py-3 align-top">
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </figure>
  );
}

/** Strong label inside body text. */
export function B({ children }: { children: ReactNode }) {
  return <span className="font-semibold text-foreground">{children}</span>;
}

/** External link to an official source. */
export function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="font-medium text-primary underline underline-offset-4" rel="noopener">
      {children}
    </a>
  );
}

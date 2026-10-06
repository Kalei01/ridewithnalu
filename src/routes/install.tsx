import { LegalFooter } from "@/components/LegalFooter";
import { Link, createFileRoute } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site";

// Facts here match how the app behaves (checked October 2026): iPhone web-app
// notifications need iOS 16.4+ and the Home Screen; GPS runs only during a trip.
const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "Do I have to install Nalu?",
    a: "No. It works in your browser. Installing makes it open full screen from your Home Screen, and on iPhone it's what lets Nalu send time-to-leave alerts.",
  },
  {
    q: "Why do iPhone alerts need the Home Screen?",
    a: "Apple only allows notifications from web apps added to the Home Screen, on iOS 16.4 or newer. Opened in a Safari tab, notifications are blocked.",
  },
  {
    q: "Does it drain my battery?",
    a: "Nalu uses precise location only while a trip is underway, and stops when the trip ends.",
  },
  {
    q: "Is Nalu free?",
    a: "Yes. No account is needed to check a trip. A free account saves your places on every phone.",
  },
  {
    q: "Is it in the App Store?",
    a: "Not yet. Installing from the browser takes a few seconds and gets you the same app.",
  },
];

export const Route = createFileRoute("/install")({
  head: () => ({
    meta: [
      { title: "Install Nalu on iPhone or Android | Nalu" },
      {
        name: "description",
        content:
          "Add Nalu to your Home Screen in a few taps on iPhone or Android, and turn on time-to-leave alerts. Free, no app store needed.",
      },
      { name: "robots", content: "index,follow" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Install Nalu on your phone" },
      { property: "og:description", content: "A few taps on iPhone or Android. Free, no app store needed." },
      { property: "og:url", content: SITE_URL + "/install" },
      { property: "og:image", content: SITE_URL + "/social-card.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: SITE_URL + "/social-card.png" },
    ],
    links: [{ rel: "canonical", href: SITE_URL + "/install" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "HowTo",
              name: "Install Nalu on iPhone",
              step: [
                { "@type": "HowToStep", text: "Open ridenalu.com in Safari." },
                { "@type": "HowToStep", text: "Tap the Share button." },
                { "@type": "HowToStep", text: "Tap Add to Home Screen, then Add." },
                { "@type": "HowToStep", text: "Open Nalu from your Home Screen and allow notifications when asked." },
              ],
            },
            {
              "@type": "FAQPage",
              mainEntity: FAQS.map((item) => ({
                "@type": "Question",
                name: item.q,
                acceptedAnswer: { "@type": "Answer", text: item.a },
              })),
            },
          ],
        }),
      },
    ],
  }),
  component: InstallPage,
});

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="mt-4 grid gap-3">
      {items.map((item, index) => (
        <li key={item} className="flex gap-3 text-lg leading-8">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-base font-bold text-primary">
            {index + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

function InstallPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8 sm:py-16">
        <Link
          to="/"
          className="text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          ← Open Nalu
        </Link>

        <header className="mt-10">
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Install Nalu on your phone</h1>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">
            A few taps, free, no app store. Once it's on your Home Screen, Nalu opens full screen and
            can tell you when it's time to leave.
          </p>
        </header>

        <section className="mt-10 rounded-2xl border border-border p-5" aria-labelledby="iphone">
          <h2 id="iphone" className="text-2xl font-bold">iPhone</h2>
          <Steps
            items={[
              "Open ridenalu.com in Safari.",
              "Tap the Share button (the square with an arrow pointing up).",
              "Scroll down and tap “Add to Home Screen”, then “Add”.",
              "Open Nalu from your Home Screen and tap “Allow” when it asks about notifications.",
            ]}
          />
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Alerts need iOS 16.4 or newer, and only work when Nalu is opened from the Home Screen.
          </p>
        </section>

        <section className="mt-6 rounded-2xl border border-border p-5" aria-labelledby="android">
          <h2 id="android" className="text-2xl font-bold">Android</h2>
          <Steps
            items={[
              "Open ridenalu.com in Chrome.",
              "Tap the menu (three dots, top right).",
              "Tap “Install app” or “Add to Home screen”, then confirm.",
              "Open Nalu and tap “Allow” when it asks about notifications.",
            ]}
          />
        </section>

        <section className="mt-12" aria-labelledby="questions">
          <h2 id="questions" className="text-2xl font-bold">Questions</h2>
          <div className="mt-4 grid gap-5">
            {FAQS.map((item) => (
              <div key={item.q}>
                <h3 className="text-lg font-semibold">{item.q}</h3>
                <p className="mt-1 text-base leading-7 text-muted-foreground">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <Link
          to="/"
          className="liquid-primary-action mt-10 inline-flex min-h-14 items-center justify-center rounded-2xl px-6 text-base font-bold"
        >
          Open Nalu
        </Link>
      </div>
      <LegalFooter />
    </main>
  );
}

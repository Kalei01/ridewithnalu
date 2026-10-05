import { DevPanel } from "@/components/DevPanel";
import { startAutoUpdate } from "@/lib/app-update";
import { UpgradeSheet } from "@/components/UpgradeSheet";
import { UsagePing } from "@/components/UsagePing";
import { WeeklyStatsSync } from "@/components/WeeklyStatsSync";
import { EmailPrompt } from "@/components/EmailPrompt";
import { startErrorReporting } from "@/lib/sentry-client";
import { NotificationPrompt } from "@/components/NotificationPrompt";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import liquidTitaniumCss from "../liquid-titanium.css?url";
import commuteCardPolishCss from "../commute-card-polish.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider, useAuth } from "../hooks/use-auth";
import { Toaster } from "../components/ui/sonner";
import { initGoogleAnalytics, trackGooglePageView } from "../lib/google-analytics";
import { onAnalyticsConsentChange } from "../lib/analytics";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">The page you're looking for doesn't exist or has been moved.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">Go home</Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">Something went wrong on our end. You can try refreshing or head back home.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">Try again</button>
          <a href="/" className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent">Go home</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Nalu" },
      { name: "description", content: "Compare Skyline, TheBus, and driving for your Oʻahu commute with Nalu." },
      // Bing Webmaster Tools ownership check (public code; ChatGPT search and Copilot use Bing).
      { name: "msvalidate.01", content: "3204E2994DF114BE6D4A0786A473DDDF" },
      { name: "author", content: "Nalu" },
      { name: "robots", content: "index,follow,max-image-preview:large" },
      { name: "theme-color", content: "#08090B" },
      { name: "apple-mobile-web-app-title", content: "Nalu" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: liquidTitaniumCss },
      { rel: "stylesheet", href: commuteCardPolishCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/icons/nalu-icon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png", sizes: "180x180" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => startAutoUpdate(), []);
  useEffect(() => {
    void startErrorReporting();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppRouteGate />
        <NotificationPrompt />
        <DevPanel />
        <UpgradeSheet />
        <UsagePing />
        <WeeklyStatsSync />
        <EmailPrompt />
        <Toaster
          position="top-center"
          richColors
          // Keep pop-ups below the iPhone's camera cutout and status bar.
          offset={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
          mobileOffset={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export const WELCOME_SEEN_KEY = "nalu-welcome-seen-v1";

const PUBLIC_PAGES = new Set(["/welcome", "/install", "/oahu-commute", "/roadwork", "/privacy", "/terms", "/disclaimer"]);

/** Pages anyone (and any search engine) can read without the app's sign-in check. */
export function isPublicContentPath(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return PUBLIC_PAGES.has(path) || path === "/guides" || path.startsWith("/guides/");
}

function AppRouteGate() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const router = useRouter();
  const { user, loading } = useAuth();
  // null = not yet read from storage (avoids hydration mismatch)
  const [welcomeSeen, setWelcomeSeen] = useState<boolean | null>(null);

  useEffect(() => {
    let seen = true;
    try {
      seen = window.localStorage.getItem(WELCOME_SEEN_KEY) === "1";
    } catch {
      seen = true;
    }
    setWelcomeSeen(seen);
  }, [pathname]);

  useEffect(() => {
    // Browse is the signed-in home, but Welcome remains directly accessible.
    // This lets signed-in users revisit the public product introduction from Settings.

    // First visit for a signed-out user shows Welcome once; afterwards "/" opens Browse.
    if (!loading && !user && welcomeSeen === false && pathname === "/") {
      try {
        if (window.localStorage.getItem(WELCOME_SEEN_KEY) === "1") {
          setWelcomeSeen(true);
          return;
        }
      } catch {
        /* fall through */
      }
      void router.navigate({ to: "/welcome", replace: true });
    }
  }, [loading, user, welcomeSeen, pathname, router]);

  useEffect(() => {
    initGoogleAnalytics();
    trackGooglePageView(pathname);
    return onAnalyticsConsentChange(() => {
      initGoogleAnalytics();
      trackGooglePageView(pathname);
    });
  }, [pathname]);

  // Public pages don't depend on sign-in, so they render straight away. On the
  // server the sign-in check never finishes, and gating them sent search
  // engines and AI assistants an empty "Getting things ready" screen.
  if (isPublicContentPath(pathname)) return <Outlet />;

  const routingToWelcome = pathname === "/" && welcomeSeen !== true;
  if (loading || routingToWelcome) {
    return (
      <main className="min-h-[100dvh] bg-background text-foreground" aria-label="Loading Nalu">
        <div className="mx-auto flex min-h-[100dvh] max-w-5xl items-center justify-center px-5">
          <div className="max-w-sm text-center">
            <h1 className="text-2xl font-black tracking-tight">Nalu</h1>
            <p className="mt-2 text-base text-muted-foreground">
              Drive, TheBus or Skyline: the fastest way across Oʻahu right now, and when to leave.
            </p>
            <p className="mt-4 text-sm text-muted-foreground">Getting things ready…</p>
            <p className="mt-6 text-sm">
              <a href="/welcome" className="underline underline-offset-4">What Nalu does</a>
              {" · "}
              <a href="/guides" className="underline underline-offset-4">Oʻahu commute guides</a>
              {" · "}
              <a href="/roadwork" className="underline underline-offset-4">Roadwork this week</a>
            </p>
          </div>
        </div>
      </main>
    );
  }

  return <Outlet />;
}

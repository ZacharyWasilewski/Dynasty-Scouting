import type { Metadata, Viewport } from "next";
import { Inter, IBM_Plex_Mono, Anton } from "next/font/google";
import { Navbar } from "@/components/layout/Navbar";
import { ConditionalFooter } from "@/components/layout/ConditionalFooter";
import { SearchProvider } from "@/components/search/SearchProvider";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { WatchlistProvider } from "@/components/watchlist/WatchlistProvider";
import { CommandPalette } from "@/components/search/CommandPalette";
import { BackNavTracker } from "@/components/layout/BackNavTracker";
import { AccountFormatSync } from "@/components/layout/AccountFormatSync";
import { PageViewTracker } from "@/components/layout/PageViewTracker";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { LiveDataGuard } from "@/components/layout/LiveDataGuard";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { getAllStatus } from "@/lib/systemStatus";
import { getProspects } from "@/lib/googleSheets";
import { getUpcomingClassYears, getActiveClassYear } from "@/lib/classCycle";
import "./globals.css";

// Prospect data is already served by the app-owned, versioned snapshot cache in
// lib/googleSheets.ts. Keeping a second Next.js full-route/ISR cache on top of
// that layer was what allowed one navigation to receive snapshot N while the
// next still received an older pre-rendered route. Render routes dynamically
// and let the single data snapshot be the only authority for prospect data.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

// Deliberately separate from --font-body (Inter, used everywhere
// else) — a genuine display typeface for the site's biggest, most
// dramatic typographic moments specifically (huge scores, hero
// numerals), not a global replacement. Anton has real graphic
// presence — condensed, all-caps-friendly, closer to sports
// broadcast/scoreboard lettering than to a typical SaaS UI font —
// without touching the 50+ existing uses of font-display (Inter)
// across the rest of the site, which stay exactly as they are.
const headline = Anton({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-headline",
  display: "swap",
});

const SITE_URL = "https://dynastydatabase.com";
const SITE_TITLE = "Dynasty Database, NFL Draft Prospect Analytics";
const SITE_DESCRIPTION =
  "Analytical grades, position rankings, and draft-class boards for dynasty-relevant prospects from every class since 2015.";

export const metadata: Metadata = {
  // metadataBase makes every page's relative OG/canonical URL resolve
  // correctly. Without it, shared links (Reddit, Twitter, Discord —
  // where a dynasty audience actually shares boards) rendered as a
  // bare URL with no title, description, or image preview.
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Dynasty Database",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    images: [{ url: "/branding/dynasty-database-logo.png", width: 1200, height: 630, alt: "Dynasty Database" }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/branding/dynasty-database-logo.png"],
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.png?v=4", sizes: "512x512", type: "image/png" },
      { url: "/favicon.ico?v=4", sizes: "16x16 32x32 48x48 64x64", type: "image/x-icon" },
    ],
    shortcut: "/favicon.ico?v=4",
    apple: "/favicon.png?v=4",
  },
  // Lets someone add this to their home screen and have it open in
  // its own standalone window — no browser address bar/tabs — the
  // same launch experience as a real installed app. Paired with
  // app/manifest.ts, which is what actually makes "Add to Home
  // Screen" available in the first place.
  // "default" renders the iOS status bar's own text/icons in dark
  // — correct for a light-background app. The old "black-translucent"
  // setting rendered them white, which was right for the old dark
  // theme but would be nearly invisible against the new light one.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Dynasty Database",
  },
};

// Next.js 14 requires theme-color (and other viewport-affecting
// values) in this separate export rather than on `metadata` — this
// is what colors the browser's own UI chrome (status bar, address
// bar tint on Android) to match the site's own light background,
// rather than defaulting to the browser's own gray/white.
//
// Real, confirmed bug this fixes: this export used to set ONLY
// themeColor. Once a page provides its own `viewport` export at
// all — even a partial one — Next.js uses exactly what's provided
// and does not merge in its own framework defaults for the
// remaining fields. That meant the actual <meta name="viewport">
// tag shipped to every visitor was missing width=device-width and
// initial-scale=1 entirely, site-wide, not on any single page.
// Without those, mobile browsers have no instruction that the page
// should always fit the device's own width, so anything on the
// page that's even slightly wider than the viewport (a chart, a
// table, anything) lets the whole page zoom out to reveal it,
// instead of the browser holding the layout at device width the
// way a correctly configured responsive site always does.
export const viewport: Viewport = {
  themeColor: "#F6F7F9",
  width: "device-width",
  initialScale: 1,
};

/**
 * The navbar highlights the next upcoming class. Resolved here from
 * the live data rather than hardcoded, so it rolls forward on its own
 * — the link previously pointed at a literal /classes/2027 in three
 * places and would have kept doing so after 2027 stopped being next.
 * getProspects reads the shared 60s snapshot, so this is a cached
 * read rather than a new fetch per page.
 */
async function getFeaturedClassYear(): Promise<string | undefined> {
  try {
    const prospects = await getProspects();
    return getUpcomingClassYears(prospects)[0] ?? getActiveClassYear(prospects);
  } catch {
    return undefined;
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const featuredClassYear = await getFeaturedClassYear();
  const sheetStatus = getAllStatus()["google-sheet"];

  return (
    <html
      lang="en"
      className={`${body.variable} ${mono.variable} ${headline.variable}`}
    >
      <body className="bg-void font-body text-ink antialiased selection:bg-accent/30 selection:text-ink">
        <AuthProvider>
          <WatchlistProvider>
            <SearchProvider>
              <BackNavTracker />
              <LiveDataGuard />
              <ServiceWorkerRegister />
              <AccountFormatSync />
              <PageViewTracker />
              <Navbar featuredClassYear={featuredClassYear} />
              {/* Bottom padding clears the fixed mobile tab bar so the
                  last bit of every page (including the footer) isn't
                  hidden behind it, harmless on /mock-draft too
                  (excluded from both the tab bar and the footer, and
                  this wrapper's padding can't affect that page's own
                  `fixed` shell regardless, since fixed positioning
                  ignores ancestor padding). */}
              {/* pb-24 (was pb-20) — the tab bar's real height on a
                  notched iPhone is its own content (~56px: icon +
                  label + padding) plus env(safe-area-inset-bottom)
                  on top of that (up to ~34px on current devices),
                  which can exceed 80px. 96px gives genuine margin
                  regardless of notch size, rather than being tight
                  on exactly the devices most likely to need it. */}
              <div className="pb-24 lg:pb-0">
                {children}
                <ConditionalFooter lastDataRefresh={sheetStatus?.lastSuccessAt ?? null} />
              </div>
              <CommandPalette />
              <BottomTabBar />
              <InstallPrompt />
            </SearchProvider>
          </WatchlistProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

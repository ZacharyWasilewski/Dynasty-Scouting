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
import { getAllStatus } from "@/lib/systemStatus";
import { getProspects } from "@/lib/googleSheets";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "Dynasty Database — NFL Draft Prospect Analytics",
  description:
    "Analytical grades, position rankings, and draft-class boards for every incoming dynasty relevant rookie since 2015.",
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
export const viewport: Viewport = {
  themeColor: "#F6F7F9",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Ensures getSheetData() has actually run (or reused the already-
  // cached/in-flight result) before checking status below — the
  // layout doesn't otherwise call this itself, and reading the status
  // store without first guaranteeing a load has happened risked a
  // race where this runs before any page in the current request has
  // populated it, showing an empty footer even when data is fine.
  // getSheetData()'s own caching means this never duplicates work a
  // page component is also about to do. Wrapped in try/catch
  // deliberately — a genuine data-fetch failure should be handled by
  // the page-level app/error.tsx boundary (which catches errors
  // thrown from page.tsx), not crash the entire app at the layout
  // level, which sits above where that boundary can catch anything.
  // Worst case here, the footer just quietly omits the freshness line.
  try {
    await getProspects();
  } catch {
    // Swallowed on purpose — see comment above.
  }
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
              <AccountFormatSync />
              <PageViewTracker />
              <Navbar />
              {/* Bottom padding clears the fixed mobile tab bar so the
                  last bit of every page (including the footer) isn't
                  hidden behind it — harmless on /mock-draft too
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
            </SearchProvider>
          </WatchlistProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

import { Hero } from "@/components/home/Hero";
import { NextClassSpotlight } from "@/components/home/NextClassSpotlight";
import { ModelOverview } from "@/components/home/ModelOverview";
import { ModelTrackRecord } from "@/components/home/ModelTrackRecord";
import { Differentiation } from "@/components/home/Differentiation";
import { ToolsShowcase } from "@/components/home/ToolsShowcase";
import { ProductShowcase } from "@/components/home/ProductShowcase";
import { TryComparison } from "@/components/home/TryComparison";
import { AccountValue } from "@/components/home/AccountValue";
import { Trending } from "@/components/home/Trending";
import { ExploreDatabase } from "@/components/home/ExploreDatabase";
import { getProspects } from "@/lib/googleSheets";
import { toHomeProspects } from "@/lib/homeProspects";
import { getScoreMovers, getSettledBaseline } from "@/lib/trending";
import { getActiveClassYear } from "@/lib/classCycle";

// Explicit here (matching the pattern on other pages like the player
// profile) rather than relying on Next's automatic revalidation —
// that mechanism tracks `fetch()` calls, and getScoreMovers below is
// a plain Postgres query, which Next has no way to know should
// invalidate this page on its own.
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Ordered to actually read as a progression rather than a list of
 * unrelated sections — Hero (what this is) -> NextClassSpotlight
 * (see it working, right now) -> ModelOverview (how it actually
 * works) -> ModelTrackRecord (proof it's accurate, now that the
 * mechanism makes sense) -> Differentiation (why this instead of a
 * crowdsourced site) -> ProductShowcase (research the live and historical board) ->
 * ToolsShowcase (make the actual decision) -> TryComparison (do one of those things right now, no account) ->
 * AccountValue (what an account specifically adds) -> Trending (a
 * reason to come back) -> ExploreDatabase (the deep end, for anyone
 * who wants to keep going). Previously ModelOverview came after the
 * track-record stats, meaning someone reached "why trust this"
 * before ever learning how it worked at all — and nothing on the
 * page mentioned Watchlist/Big Board/Team Sync/My Stuff or explained
 * what makes this different from a crowdsourced site, at all.
 */
export default async function HomePage() {
  // getProspects() and getSettledBaseline() are independent reads —
  // neither depends on the other's result — but were previously
  // awaited one after another (getScoreMovers did its own internal
  // fetch only after prospects had already fully resolved). Running
  // them concurrently removes one full sequential round-trip from
  // every homepage load; confirmed from real production logs that
  // this page was consistently taking 420-500ms on every hit, not
  // just occasionally.
  const [prospects, settledBaseline] = await Promise.all([getProspects(), getSettledBaseline()]);
  const { risers, fallers } = await getScoreMovers(prospects, 5, settledBaseline);
  const activeClassYear = getActiveClassYear(prospects);
  // Everything below reads only a narrow slice of each prospect, so
  // the full objects never need to cross into the client payload.
  // See lib/homeProspects.ts for the audited field list and why.
  const homeProspects = toHomeProspects(prospects);

  return (
    <main>
      <Hero prospects={homeProspects} activeClassYear={activeClassYear} />
      <NextClassSpotlight prospects={homeProspects} classYear={activeClassYear} />
      <ModelOverview />
      <ModelTrackRecord prospects={homeProspects} />
      <Differentiation />
      <ProductShowcase prospects={homeProspects} />
      <ToolsShowcase />
      <TryComparison />
      <AccountValue />
      <Trending risers={risers} fallers={fallers} />
      <ExploreDatabase prospects={homeProspects} />
    </main>
  );
}

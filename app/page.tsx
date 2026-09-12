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
 * Ordered as one continuous story for a visitor who knows nothing
 * about dynasty going in: UNDERSTAND (Hero: what this is, then
 * ModelOverview: how a score/tier is actually built) -> EXPLORE
 * (NextClassSpotlight: see real scores and tier badges in the wild,
 * now that those mean something) -> VERIFY (ModelTrackRecord: the
 * model's real hit rate, then Differentiation: why that number is
 * worth more than a consensus ranking) -> USE (ProductShowcase:
 * research the live and historical board -> ToolsShowcase: make the
 * actual decision -> TryComparison: do one of those things right
 * now, no account) -> COME BACK (AccountValue: what an account adds
 * -> Trending: a reason to check back in) -> ExploreDatabase (the
 * deep end, for anyone who wants to keep going).
 *
 * ModelOverview moved ahead of NextClassSpotlight specifically:
 * NextClassSpotlight renders real tier badges ("Elite", "Flex", etc.)
 * and raw 0-100 scores, and previously did so before ModelOverview
 * ever explained what a tier or the scale meant — a first-time
 * visitor hit real jargon before its definition. Nothing else about
 * either section changed.
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
      <ModelOverview />
      <NextClassSpotlight prospects={homeProspects} classYear={activeClassYear} />
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

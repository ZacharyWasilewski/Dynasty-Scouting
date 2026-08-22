import { Hero } from "@/components/home/Hero";
import { NextClassSpotlight } from "@/components/home/NextClassSpotlight";
import { ModelOverview } from "@/components/home/ModelOverview";
import { ModelTrackRecord } from "@/components/home/ModelTrackRecord";
import { Differentiation } from "@/components/home/Differentiation";
import { ToolsShowcase } from "@/components/home/ToolsShowcase";
import { TryComparison } from "@/components/home/TryComparison";
import { AccountValue } from "@/components/home/AccountValue";
import { Trending } from "@/components/home/Trending";
import { ExploreDatabase } from "@/components/home/ExploreDatabase";
import { getProspects } from "@/lib/googleSheets";
import { getScoreMovers } from "@/lib/trending";

// Explicit here (matching the pattern on other pages like the player
// profile) rather than relying on Next's automatic revalidation —
// that mechanism tracks `fetch()` calls, and getScoreMovers below is
// a plain Postgres query, which Next has no way to know should
// invalidate this page on its own.
export const revalidate = 60;

// The active devy cycle this app is currently building toward — see
// the Hero's own "2027 Draft Cycle · In Progress" badge, which this
// intentionally matches rather than introducing a second source of
// truth for the same thing.
const ACTIVE_CLASS_YEAR = "2027";

/**
 * Ordered to actually read as a progression rather than a list of
 * unrelated sections — Hero (what this is) -> NextClassSpotlight
 * (see it working, right now) -> ModelOverview (how it actually
 * works) -> ModelTrackRecord (proof it's accurate, now that the
 * mechanism makes sense) -> Differentiation (why this instead of a
 * crowdsourced site) -> ToolsShowcase (what you can do with it) ->
 * TryComparison (do one of those things right now, no account) ->
 * AccountValue (what an account specifically adds) -> Trending (a
 * reason to come back) -> ExploreDatabase (the deep end, for anyone
 * who wants to keep going). Previously ModelOverview came after the
 * track-record stats, meaning someone reached "why trust this"
 * before ever learning how it worked at all — and nothing on the
 * page mentioned Watchlist/Big Board/Team Sync/My Stuff or explained
 * what makes this different from a crowdsourced site, at all.
 */
export default async function HomePage() {
  const prospects = await getProspects();
  const { risers, fallers } = await getScoreMovers(prospects);

  // Defaults for the "try it yourself" comparison widget — the
  // highest-graded drafted player overall, paired with the
  // second-highest at that SAME position (never cross-position: a
  // player's subscores are position-specific, so a QB-vs-WR
  // comparison isn't just unusual, it's not a valid one — see
  // ComparisonPanel/PlayerPicker's own positionFilter constraint,
  // which this matches exactly). Computed live rather than
  // hardcoded, so this never goes stale or shows a made-up example.
  const drafted = prospects.filter((p) => p.hasDraftData === true && p.ddScore1QB !== undefined);
  const topOverall = [...drafted].sort((a, b) => (b.ddScore1QB ?? 0) - (a.ddScore1QB ?? 0))[0];
  const topAtSamePosition = topOverall
    ? drafted
        .filter((p) => p.position === topOverall.position && p.id !== topOverall.id)
        .sort((a, b) => (b.ddScore1QB ?? 0) - (a.ddScore1QB ?? 0))[0]
    : undefined;

  return (
    <main>
      <Hero prospects={prospects} />
      <NextClassSpotlight prospects={prospects} classYear={ACTIVE_CLASS_YEAR} />
      <ModelOverview />
      <ModelTrackRecord prospects={prospects} />
      <Differentiation />
      <ToolsShowcase />
      <TryComparison prospects={prospects} defaultA={topOverall} defaultB={topAtSamePosition} />
      <AccountValue />
      <Trending risers={risers} fallers={fallers} />
      <ExploreDatabase prospects={prospects} />
    </main>
  );
}

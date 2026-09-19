import { getProspects } from "@/lib/googleSheets";
import { getActiveMockClass, getFutureMockClasses } from "@/lib/mockDraft";
import { MockDraftExperience } from "@/components/mockDraft/MockDraftExperience";
import { computeHitRateByPositionAndTier, type LeagueFormatSelection } from "@/lib/analytics";
import { ALL_TIERS } from "@/lib/tiers";
import type { Position } from "@/types/prospect";
import type { LeagueFormat } from "@/lib/ddScore";

// Public, identical for every visitor — no reason this should
// re-render from scratch on every single request when nothing about
// it is personalized server-side.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Mock Draft, Dynasty Database",
  description: "Practice dynasty rookie drafts using the Dynasty Database model or Community Rankings.",
};

const MARQUEE_POSITIONS: Position[] = ["QB", "RB", "WR", "TE"];

const FORMATS: { key: LeagueFormat; selection: LeagueFormatSelection }[] = [
  { key: "1QB", selection: { qbFormat: "1QB", tepFormat: "STANDARD" } },
  { key: "1QB_TEP", selection: { qbFormat: "1QB", tepFormat: "TEP" } },
  { key: "SUPERFLEX", selection: { qbFormat: "SF", tepFormat: "STANDARD" } },
  { key: "SUPERFLEX_TEP", selection: { qbFormat: "SF", tepFormat: "TEP" } },
];

export default async function MockDraftPage() {
  const prospects = await getProspects();
  const classYear = getActiveMockClass();
  const futureClassYears = getFutureMockClasses(prospects, classYear);
  const allMockClassYears = [classYear, ...futureClassYears];

  const classProspectsByYear: Record<string, typeof prospects> = {};
  for (const year of allMockClassYears) {
    classProspectsByYear[year] = prospects.filter((p) => p.draftClass === year);
  }

  // Historical cohorts for each displayed score stage and league format.
  const tierHitRatesByFormat: Record<string, Record<string, number | null>> = {};
  for (const f of FORMATS) {
    const rows: Record<string, number | null> = {};
    for (const pos of MARQUEE_POSITIONS) {
      for (const stage of ["dd", "preDraft", "raw"] as const) {
        for (const row of computeHitRateByPositionAndTier(prospects, pos, f.selection, ALL_TIERS, stage)) {
          rows[`${stage}:${pos}:${row.tier}`] = row.hitRate;
          rows[`sample:${stage}:${pos}:${row.tier}`] = row.count;
        }
      }
    }
    tierHitRatesByFormat[f.key] = rows;
  }

  return (
    <main className="w-full md:min-h-[calc(100dvh-4rem)]">
      <MockDraftExperience
        classProspectsByYear={classProspectsByYear}
        defaultClassYear={classYear}
        tierHitRatesByFormat={tierHitRatesByFormat}
      />
    </main>
  );
}

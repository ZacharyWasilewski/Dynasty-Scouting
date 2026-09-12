import { notFound } from "next/navigation";
import { PositionHeader } from "@/components/positions/PositionHeader";
import { PositionRankingsWithChart } from "@/components/positions/PositionRankingsWithChart";
import { getPositionTheme, POSITION_THEMES } from "@/lib/positionThemes";
import { getProspects } from "@/lib/googleSheets";
import { getScoreDeltas } from "@/lib/trending";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export function generateStaticParams() {
  return Object.keys(POSITION_THEMES).map((position) => ({ position }));
}

export function generateMetadata({ params }: { params: { position: string } }) {
  const theme = getPositionTheme(params.position);
  return { title: theme ? `${theme.label}, Dynasty Database` : "Position, Dynasty Database" };
}

export default async function PositionPage({ params }: { params: { position: string } }) {
  const theme = getPositionTheme(params.position);
  if (!theme) notFound();

  const allProspects = await getProspects();
  const prospects = allProspects.filter((p) => p.position === theme.code);
  // Score deltas since the last settled Trending baseline — see
  // lib/trending.ts. A Map isn't serializable across the Server ->
  // Client Component boundary, so this crosses as a plain object and
  // gets turned back into a Map inside PositionExplorer.
  const scoreDeltas = Object.fromEntries(await getScoreDeltas(prospects));

  return (
    <main>
      <PositionHeader theme={theme} />
      <PositionRankingsWithChart prospects={prospects} theme={theme} scoreDeltas={scoreDeltas} />
    </main>
  );
}

import { notFound } from "next/navigation";
import { BoardEditor } from "@/components/board/BoardEditor";
import { getProspects } from "@/lib/googleSheets";
import { buildRanksWithinCollection } from "@/lib/ddScore";
import { getMockableClassYears } from "@/lib/mockDraft";

export const metadata = {
  title: "My Big Board, Dynasty Database",
};

// Same reasoning as every other page keyed off class year (see
// app/classes/[year]/page.tsx) — this page's server-rendered part
// (the public, default-DD-ranked prospect list) is identical for
// every visitor regardless of who's logged in; a signed-in user's
// actual custom order is fetched client-side inside BoardEditor
// itself. Without this, the page had no caching directive at all,
// meaning every single visit re-ran the full server render from
// scratch instead of being served from a warm, pre-built response —
// a likely contributor to inconsistent load times.
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Reordering happens via up/down clicks, not drag-and-drop — moving
// someone from the very bottom of a 300-player class to the top would
// take hundreds of clicks. Capping to the top 100 by default DD rank
// keeps every reorder realistic while still covering every player a
// real startup or rookie draft would plausibly touch.
const BOARD_LIMIT = 100;

export default async function BoardEditorPage({ params }: { params: { year: string } }) {
  const allProspects = await getProspects();
  // Only the same classes Mock Draft offers — matches the index page,
  // and closes off directly visiting e.g. /board/2018 for a class
  // whose real outcomes are already known.
  if (!getMockableClassYears(allProspects).includes(params.year)) notFound();

  const classProspects = allProspects.filter((p) => p.draftClass === params.year);
  if (classProspects.length === 0) notFound();

  const rankMap = buildRanksWithinCollection(classProspects, "SUPERFLEX");
  const prospects = [...classProspects]
    .sort((a, b) => (rankMap.get(a.id) ?? Infinity) - (rankMap.get(b.id) ?? Infinity))
    .slice(0, BOARD_LIMIT);

  return <BoardEditor prospects={prospects} classYear={params.year} />;
}

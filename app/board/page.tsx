import { BoardIndexContent } from "@/components/board/BoardIndexContent";
import { getProspects } from "@/lib/googleSheets";
import { getMockableClassYears } from "@/lib/mockDraft";

// Public, identical for every visitor (a signed-in user's saved
// boards are fetched client-side inside each individual board page,
// not here) — same reasoning as the fix on app/board/[year]/page.tsx.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "My Big Board, Dynasty Database",
};

export default async function BoardIndexPage() {
  const prospects = await getProspects();
  // Same set of classes Mock Draft offers — a personal board only
  // makes sense for a class you'd actually draft, not a class from
  // 2018 whose outcomes are already known.
  const classYears = getMockableClassYears(prospects);
  return <BoardIndexContent classYears={classYears} />;
}

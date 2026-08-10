import type { Prospect } from "@/types/prospect";

const PICKS_PER_ROUND = 12;
const TOTAL_ROUNDS = 4;
const TOTAL_PICKS = PICKS_PER_ROUND * TOTAL_ROUNDS; // 48

/** The score a prospect ranks by — their final Prospect Score once
 *  it exists, otherwise their Pre-Draft Score for a class that
 *  hasn't been fully graded yet (e.g. still-upcoming classes). */
function rankingScore(p: Prospect): number | undefined {
  return p.grade?.overall ?? p.preDraftScore;
}

/**
 * A player's projected draft slot, based on where they rank within
 * their own class (across all positions) — not their global
 * site-wide rank. Uses each prospect's final Prospect Score once
 * it's available, and falls back to their Pre-Draft Score for a
 * class that hasn't been fully graded yet (i.e. still missing ADP
 * and Opportunity). Rounds are 12 picks each; anyone outside the
 * top 48 in their class is "Waiver Wire".
 */
export function computeDraftProjectionLabel(
  prospect: Prospect,
  allProspects: Prospect[]
): string {
  const prospectScore = rankingScore(prospect);
  if (!prospect.draftClass || prospectScore === undefined) {
    return "Unranked";
  }

  const classmates = allProspects
    .filter((p) => p.draftClass === prospect.draftClass && rankingScore(p) !== undefined)
    .sort((a, b) => (rankingScore(b) ?? 0) - (rankingScore(a) ?? 0));

  const rank = classmates.findIndex((p) => p.id === prospect.id) + 1;
  if (rank <= 0) return "Unranked";
  if (rank > TOTAL_PICKS) return "Waiver Wire";

  const round = Math.ceil(rank / PICKS_PER_ROUND);
  const posInRound = ((rank - 1) % PICKS_PER_ROUND) + 1;
  const segment = posInRound <= 4 ? "Early" : posInRound <= 8 ? "Mid" : "Late";

  return `${segment} Round ${round}`;
}

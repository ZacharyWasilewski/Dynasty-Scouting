import { getScoreDeltas, type ScoreMover } from "@/lib/trending";
import type { PositionNeed } from "@/lib/teamNeeds";
import type { Prospect } from "@/types/prospect";

/**
 * Devy prospects whose Pre-Draft Score has moved recently AND who
 * play a position this team actually needs — the point of connecting
 * Trending (what changed) to Team Sync (what you need) instead of
 * leaving them as two unrelated features. A mover at a position
 * you're already stocked at isn't actionable information for this
 * team specifically; this filters down to the ones that are.
 */
export async function getMoversAtNeeds(
  prospects: Prospect[],
  needs: PositionNeed[],
  limit = 5
): Promise<ScoreMover[]> {
  const neededPositions = new Set(needs.filter((n) => n.needScore > 0).map((n) => n.position));
  if (neededPositions.size === 0) return [];

  const deltas = await getScoreDeltas(prospects);
  if (deltas.size === 0) return [];

  const byId = new Map(prospects.map((p) => [p.id, p]));
  const movers: ScoreMover[] = [];
  for (const [id, delta] of deltas) {
    const p = byId.get(id);
    if (!p || !neededPositions.has(p.position as PositionNeed["position"])) continue;
    movers.push({ id, name: p.name, position: p.position, school: p.school, schoolLogoUrl: p.schoolLogoUrl, score: p.preDraftScore ?? 0, delta });
  }

  movers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return movers.slice(0, limit);
}

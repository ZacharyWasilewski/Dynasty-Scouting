import type { Prospect } from "@/types/prospect";
import type { LeagueFormat } from "@/lib/ddScore";
import { scoreAtStage } from "@/lib/scoreStage";
export function evaluationStage(p: Prospect) { return p.hasDraftData === true ? "dd" : p.preDraftScore !== undefined ? "preDraft" : "raw"; }
export function scopedRanks(prospects: Prospect[], format: LeagueFormat): Map<string, number> {
 const groups = new Map<string, Prospect[]>();
 for (const p of prospects) { const key = p.hasDraftData === true ? "drafted" : `${p.draftClass}:${evaluationStage(p)}`; groups.set(key, [...(groups.get(key) ?? []), p]); }
 const ranks = new Map<string, number>();
 for (const pool of groups.values()) pool.filter(p => Number.isFinite(scoreAtStage(p, evaluationStage(p), format))).sort((a,b) => scoreAtStage(b, evaluationStage(b), format)! - scoreAtStage(a, evaluationStage(a), format)! || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)).forEach((p,i) => ranks.set(p.id,i+1));
 return ranks;
}

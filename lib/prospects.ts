import type { Position } from "@/types/prospect";
export { ALL_TIERS } from "@/lib/tiers";

/**
 * Static filter option lists. This file only holds option lists
 * that don't change with the data — every position graded and
 * tracked on this site. The dynasty tier scale lives in lib/tiers.ts.
 */

export const ALL_POSITIONS: Position[] = ["QB", "RB", "WR", "TE"];

import type { LeagueFormat } from "@/lib/ddScore";

/**
 * URL query values for each format, matching what ProfileHeader reads
 * back out (searchParams.get("format")).
 *
 * This used to be defined privately inside RankingsTable.tsx, and only
 * RankingsTable's own player links used it — PositionExplorer built its
 * player links as a plain `/players/${id}` with no format at all. That
 * meant clicking a player from a position page silently reset their
 * view to Superflex regardless of what format they'd actually been
 * looking at, exactly the kind of surprise state change format
 * handling elsewhere in the app is deliberately built to prevent.
 *
 * Centralized here so every list of player links carries format the
 * same way, rather than each one needing to remember to.
 */
const FORMAT_QUERY_PARAM: Record<LeagueFormat, string> = {
  "1QB": "1qb",
  SUPERFLEX: "sf",
  "1QB_TEP": "1qb-tep",
  SUPERFLEX_TEP: "sf-tep",
};

export function playerHref(id: string, format: LeagueFormat): string {
  const formatParam = FORMAT_QUERY_PARAM[format];
  return formatParam ? `/players/${id}?format=${formatParam}` : `/players/${id}`;
}

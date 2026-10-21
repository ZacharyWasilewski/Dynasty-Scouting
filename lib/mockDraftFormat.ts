import type { Prospect } from "@/types/prospect";
import { gradeTextColorClass } from "@/lib/utils";
import { type MockEngine, type MockPickTimer, type MockSettings, getRankForFormat, normalizePlayerName } from "@/lib/mockDraft";

/**
 * Pure helper functions and constants originally defined inline at
 * the top of MockDraftExperience.tsx (which was 2,200+ lines — by far
 * the largest component on the site). Extracted here specifically
 * because none of these close over that component's own state; every
 * one is a plain function of its arguments, so moving them out
 * doesn't touch any of the actual draft logic, just where it's typed.
 */

export function gradeTone(grade: string) {
  return gradeTextColorClass(grade);
}

export function communityLookupKey(name: string): string {
  return normalizePlayerName(name)
    .replace(/\s+(?:jr|sr|ii|iii|iv|v)\.?$/i, "")
    .trim();
}

export function engineLabel(engine: MockEngine) {
  return engine === "DD" ? "Dynasty Database" : "Community Rankings";
}

/** Short form for the same setting, used only at mobile widths where
 *  the full name was crowding the title next to it (both wrapping
 *  awkwardly). "DD" already means Dynasty Database everywhere else on
 *  this site (DD Score, DD Rank) — reusing that instead of inventing
 *  a new abbreviation. */
export function engineLabelShort(engine: MockEngine) {
  return engine === "DD" ? "DD" : "CR";
}

export function parsePickTimer(raw: string): MockPickTimer {
  if (raw === "UNTIMED") return "UNTIMED";
  const n = Number(raw);
  return (n === 15 || n === 30 || n === 45 || n === 60 || n === 120 || n === 300 ? n : "UNTIMED") as MockPickTimer;
}

export function formatPickTimerLabel(pickTimer: MockPickTimer): string {
  if (pickTimer === "UNTIMED") return "Untimed";
  if (pickTimer < 60) return `${pickTimer} sec`;
  const minutes = pickTimer / 60;
  return `${minutes} min`;
}

export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function playerRankLabel(p: Prospect, settings: MockSettings, rankMap?: Map<string, number>) {
  return rankMap?.get(p.id) ?? getRankForFormat(p, settings.qbFormat, settings.teFormat) ?? p.rank ?? "—";
}

// Text/dot colors deepened from their original values (#60A5FA,
// #4ADE80, #38BDF8, #C084FC) — those were bright, pale colors
// specifically tuned for contrast against the board's old dark-navy
// background. Now that the board matches the site's light theme,
// those same colors would have the same readability problem the
// site's tier and position-theme colors already had fixed elsewhere
// this session — pale text with poor contrast against a light
// background. The bg/border tints (low-opacity, saturated base
// colors) didn't have this problem and are unchanged.
export const POSITION_CLASS: Record<string, string> = {
  QB: "bg-[#2563EB]/15 text-[#2563EB] border-[#2563EB]/35",
  RB: "bg-[#16A34A]/15 text-[#15803D] border-[#16A34A]/35",
  WR: "bg-[#0EA5E9]/15 text-[#0C7DAD] border-[#0EA5E9]/35",
  TE: "bg-[#A855F7]/15 text-[#8B4FD6] border-[#A855F7]/35",
};

export const POSITION_DOT: Record<string, string> = {
  QB: "bg-[#2563EB]",
  RB: "bg-[#16A34A]",
  WR: "bg-[#0C7DAD]",
  TE: "bg-[#8B4FD6]",
};

/** Same 4 positions this whole feature already treats as the complete
 *  set (POSITION_CLASS/POSITION_DOT above) — used to group the My
 *  Team tab in a fixed, sensible reading order (QB → RB → WR → TE)
 *  rather than the order picks happened to be made in. */
export const POSITION_ORDER = ["QB", "RB", "WR", "TE"];

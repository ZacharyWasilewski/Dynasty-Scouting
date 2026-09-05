"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bookmark,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Filter,
  LayoutGrid,
  Link2,
  Pause,
  Play,
  RotateCcw,
  Search,
  Share2,
  Sparkles,
  Trophy,
  Users,
  X,
  Zap,
} from "@/components/ui/SiteIcons";
import type { Prospect, Tier } from "@/types/prospect";
import { buildRanksWithinCollection, type LeagueFormat } from "@/lib/ddScore";
import { setMockDraftStep } from "@/lib/mockDraftStep";
import { playOnClockSound, playPickSound, playTickSound } from "@/lib/mockDraftSounds";
import {
  type CommunityPlayer,
  type MockEngine,
  type MockLeagueSize,
  type MockPick,
  type MockPickTimer,
  type MockQBFormat,
  type MockSettings,
  type MockTEFormat,
  formatPick,
  deriveIsUserTurn,
  deriveManualEntryLimit,
  getCommunityFormatKey,
  getCommunityFormatLabel,
  getPickGrade,
  getRankForFormat,
  getScoreForFormat,
  getTierForFormat,
  normalizePlayerName,
  weightedRandomPick,
} from "@/lib/mockDraft";
import { cn, gradeTextColorClass } from "@/lib/utils";
import { getGlobalFormat, reportFormatUsed } from "@/lib/globalFormat";
import { track } from "@/lib/track";
import { MockDraftPlayerCard } from "@/components/mockDraft/MockDraftPlayerCard";
import { getTierColor } from "@/lib/tiers";
import { useAuth } from "@/components/auth/AuthProvider";

interface PositionNeedSnapshot {
  position: string;
  needScore: number;
}

interface SyncedTeamNeeds {
  leagueName: string;
  teamName: string;
  /** Kept alongside the needs snapshot so the real-pick-order feature
   *  below can fetch draft ownership for this same league/team
   *  without a second round-trip to re-discover which team is
   *  synced. */
  leagueId: string;
  rosterId: number;
  /** Full per-position snapshot from the moment this team was
   *  synced — kept (not just a flat list of "needy" positions) so
   *  the in-draft suggestion logic below can compare positions
   *  against each other as picks are made. See isPositionSuggested. */
  needs: PositionNeedSnapshot[];
  /** True when every tracked position was already at/above the
   *  needScore threshold (i.e. no real needs) — "Suggested" falls
   *  back to Best Player Available rather than showing nothing. */
  bpaMode: boolean;
  /** The real league's actual scoring format, detected from Sleeper
   *  at sync time — see isTepLeague in lib/teamNeeds.ts. Applied to
   *  qbFormat/teFormat automatically on sync (see the fetch effect
   *  below), so a synced draft defaults to matching the real league
   *  instead of whatever was last selected. */
  qbFormat: MockQBFormat;
  teFormat: MockTEFormat;
}

/**
 * Whether a position should keep showing up under "Suggested" given
 * the picks the user has actually made so far this mock. This is
 * what makes the tab evolve mid-draft instead of staying frozen at
 * the Team Sync snapshot taken before the draft started:
 *
 * - Never a real need to begin with (needScore <= 0) → never shown.
 * - A real need, never yet drafted → always shown.
 * - Drafted twice already → dropped regardless of how big the
 *   original gap was (assume two rookies is enough for anyone).
 * - Drafted exactly once → stays shown only if it was a clearly
 *   bigger need than every other remaining need (at least double).
 *   A modest lead (e.g. a 47th-percentile need vs. a 56th-percentile
 *   one) is treated as "one pick reasonably addressed this," so it
 *   drops off in favor of the other need; a large lead (e.g. 20th
 *   percentile vs. 58th) means one rookie clearly wasn't enough to
 *   close the gap, so it keeps being suggested.
 */
function isPositionStillSuggested(
  position: string,
  syncedNeeds: SyncedTeamNeeds,
  draftedCounts: Record<string, number>
): boolean {
  const thisNeed = syncedNeeds.needs.find((n) => n.position === position);
  if (!thisNeed || thisNeed.needScore <= 0) return false;

  const draftedCount = draftedCounts[position] ?? 0;
  if (draftedCount === 0) return true;
  if (draftedCount >= 2) return false;

  const otherMaxNeed = Math.max(
    0,
    ...syncedNeeds.needs.filter((n) => n.position !== position && n.needScore > 0).map((n) => n.needScore)
  );
  if (otherMaxNeed === 0) return true;
  return thisNeed.needScore >= otherMaxNeed * 2;
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
const POSITION_CLASS: Record<string, string> = {
  QB: "bg-[#2563EB]/15 text-[#2563EB] border-[#2563EB]/35",
  RB: "bg-[#16A34A]/15 text-[#15803D] border-[#16A34A]/35",
  WR: "bg-[#0EA5E9]/15 text-[#0C7DAD] border-[#0EA5E9]/35",
  TE: "bg-[#A855F7]/15 text-[#8B4FD6] border-[#A855F7]/35",
};

const POSITION_DOT: Record<string, string> = {
  QB: "bg-[#2563EB]",
  RB: "bg-[#16A34A]",
  WR: "bg-[#0C7DAD]",
  TE: "bg-[#8B4FD6]",
};

/** Same 4 positions this whole file already treats as the complete
 *  set (POSITION_CLASS/POSITION_DOT above) — used to group the My
 *  Team tab in a fixed, sensible reading order (QB → RB → WR → TE)
 *  rather than the order picks happened to be made in. */
const POSITION_ORDER = ["QB", "RB", "WR", "TE"];


function gradeTone(grade: string) {
  return gradeTextColorClass(grade);
}

function communityLookupKey(name: string): string {
  return normalizePlayerName(name)
    .replace(/\s+(?:jr|sr|ii|iii|iv|v)\.?$/i, "")
    .trim();
}

function engineLabel(engine: MockEngine) {
  return engine === "DD" ? "Dynasty Database" : "Community Rankings";
}

/** Short form for the same setting, used only at mobile widths where
 *  the full name was crowding the title next to it (both wrapping
 *  awkwardly). "DD" already means Dynasty Database everywhere else on
 *  this site (DD Score, DD Rank) — reusing that instead of inventing
 *  a new abbreviation. */
function engineLabelShort(engine: MockEngine) {
  return engine === "DD" ? "DD" : "CR";
}

function parsePickTimer(raw: string): MockPickTimer {
  if (raw === "UNTIMED") return "UNTIMED";
  const n = Number(raw);
  return (n === 15 || n === 30 || n === 45 || n === 60 || n === 120 || n === 300 ? n : "UNTIMED") as MockPickTimer;
}

function formatPickTimerLabel(pickTimer: MockPickTimer): string {
  if (pickTimer === "UNTIMED") return "Untimed";
  if (pickTimer < 60) return `${pickTimer} sec`;
  const minutes = pickTimer / 60;
  return `${minutes} min`;
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function playerRankLabel(p: Prospect, settings: MockSettings, rankMap?: Map<string, number>) {
  return rankMap?.get(p.id) ?? getRankForFormat(p, settings.qbFormat, settings.teFormat) ?? p.rank ?? "—";
}

/** Available-player row. The identity block is always sticky so the
 *  horizontal list can scroll natively without a JS threshold/snap
 *  between two different name layouts. */
function AvailablePlayerRow({
  p,
  rank,
  score,
  tier,
  cr,
  diff,
  canPick,
  isSuggested,
  positionTierHitRates,
  queue,
  toggleQueued,
  setExpandedPlayerId,
  closePlayerSearch,
  makePick,
}: {
  p: Prospect;
  rank: number | string;
  score: number | undefined;
  tier: Tier | undefined;
  cr: number | undefined;
  diff: number | null;
  canPick: boolean;
  isSuggested: boolean;
  positionTierHitRates: Map<string, number>;
  queue: string[];
  toggleQueued: (id: string) => void;
  setExpandedPlayerId: (id: string | null) => void;
  closePlayerSearch: () => void;
  makePick: (player: Prospect, userPick: boolean) => void;
}) {
  return (
    <div
      className={cn("mock-player-row flex w-max min-w-full items-center gap-0 border-b border-border-strong border-l-[3px] bg-surface px-0", canPick && "sm:hover:bg-surface-raised/70")}
      style={{ borderLeftColor: tier ? getTierColor(tier) : "transparent" }}
    >
      <div className="mock-player-identity order-2 flex h-full w-[190px] md:order-none min-w-[190px] items-center gap-2 bg-surface px-3 py-2 sm:w-[220px] sm:min-w-[220px] sm:px-4">
        <span className="w-7 shrink-0 text-right font-mono text-[10px] text-ink-tertiary">{rank}</span>
        <span className={cn("h-2 w-2 shrink-0 rounded-full", POSITION_DOT[p.position])} />
        <button
          type="button"
          onClick={() => {
            setExpandedPlayerId(p.id);
            closePlayerSearch();
          }}
          className="min-w-0 flex-1 text-left"
          aria-haspopup="dialog"
        >
          <span className="flex min-w-0 items-center gap-1">
            <span className="min-w-0 whitespace-normal break-words text-sm font-semibold leading-tight text-ink max-md:whitespace-nowrap max-md:break-normal">
              <span className="md:hidden block min-w-0 truncate">{p.name}</span>
              <span className="hidden md:inline">{p.name}</span>
            </span>
          </span>
          {isSuggested && (
            <span className="mt-1 inline-flex rounded-full bg-accent/15 px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-widest2 text-accent">
              Need
            </span>
          )}
        </button>
      </div>
      <div className="mock-player-actions flex h-full shrink-0 items-center bg-surface pl-2">
        {canPick && (
          <button
            type="button"
            onClick={() => { closePlayerSearch(); makePick(p, true); }}
            className="mock-player-pick order-1 mr-2 flex h-[42px] w-[84px] min-w-[84px] max-w-[84px] shrink-0 flex-none items-center justify-center whitespace-nowrap bg-accent px-3 py-2 text-xs font-semibold text-white hover:bg-accent-dim md:order-2 md:mr-0 md:ml-2 md:w-auto md:min-w-[96px] md:max-w-none md:flex-none md:px-5"
            aria-label={`Pick ${p.name}`}
          >
            Pick
          </button>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); toggleQueued(p.id); }}
          aria-label={queue.includes(p.id) ? `Remove ${p.name} from queue` : `Add ${p.name} to queue`}
          className={cn("mock-player-bookmark order-3 ml-2 flex h-[42px] w-[56px] shrink-0 items-center justify-center border-r border-border-strong bg-surface md:order-1 md:ml-0", queue.includes(p.id) ? "bg-accent/10 text-accent" : "text-ink-tertiary hover:text-ink")}
        >
          <Bookmark className="h-5 w-5" fill={queue.includes(p.id) ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="mock-player-stat order-4 w-14 shrink-0 max-md:w-20 max-md:min-w-[80px] md:order-none border-l border-border px-3"><p className="whitespace-normal break-words font-mono text-[8px] uppercase tracking-widest2 text-ink-tertiary max-md:whitespace-nowrap max-md:break-normal">DD Score</p><p className="mt-0.5 whitespace-normal break-words text-xs font-semibold text-ink max-md:whitespace-nowrap max-md:break-normal">{score?.toFixed(1) ?? "TBD"}</p></div>
      <div className="mock-player-stat order-5 w-14 shrink-0 max-md:w-20 max-md:min-w-[80px] md:order-none border-l border-border px-3"><p className="whitespace-normal break-words font-mono text-[8px] uppercase tracking-widest2 text-ink-tertiary max-md:whitespace-nowrap max-md:break-normal">Hit Rate</p><p className="mt-0.5 whitespace-normal break-words text-xs font-semibold text-ink max-md:whitespace-nowrap max-md:break-normal">{tier && positionTierHitRates.get(`${p.position}:${tier}`) !== undefined ? `${positionTierHitRates.get(`${p.position}:${tier}`)!.toFixed(0)}%` : "—"}</p></div>
      <div className="mock-player-stat order-6 w-14 shrink-0 max-md:w-20 max-md:min-w-[80px] md:order-none border-l border-border px-3"><p className="whitespace-normal break-words font-mono text-[8px] uppercase tracking-widest2 text-ink-tertiary max-md:whitespace-nowrap max-md:break-normal">COMM</p><p className={cn("mt-0.5 whitespace-normal break-words text-xs font-semibold max-md:whitespace-nowrap max-md:break-normal", diff === null ? "text-ink-tertiary" : diff > 0 ? "text-riser" : diff < 0 ? "text-faller" : "text-ink-secondary")}>{cr ?? "—"}</p></div>
      {/* Draft Proj and School removed — reported directly as
          wanting numeric values only. Real subscores added in
          their place instead: reported directly that different
          rows don't need to show the same stats, as long as each
          one carries its own header, which every subscore already
          does (its own label). Filtered to value !== undefined
          specifically — a subscore can be text-only (e.g. "QB1"
              instead of a percentile), and those stay excluded to
              keep this numeric-only, same as Tier Hit Rate/DD Score/
              COMM already are. This is also genuinely why different
              positions now show different columns here (a QB and a
              WR have different subscores), matching what was reported
              as the actual Sleeper behavior, not something invented
              to look similar to it. */}
          {p.subScores?.filter((s): s is typeof s & { value: number } => s.value !== undefined).map((s) => (
            <div key={s.label} className="mock-player-stat order-7 w-14 shrink-0 max-md:w-20 max-md:min-w-[80px] md:order-none border-l border-border px-3">
              <p className="whitespace-normal break-words font-mono text-[8px] uppercase tracking-widest2 text-ink-tertiary max-md:whitespace-nowrap max-md:break-normal">{s.label}</p>
              <p className="mt-0.5 whitespace-normal break-words text-xs font-semibold text-ink max-md:whitespace-nowrap max-md:break-normal">{s.value}</p>
            </div>
          ))}
    </div>
  );
}

export function MockDraftExperience({
  classProspectsByYear,
  defaultClassYear,
  tierHitRatesByFormat,
}: {
  /** Prospects for every mockable class, keyed by draft class year. */
  classProspectsByYear: Record<string, Prospect[]>;
  defaultClassYear: string;
  /** Real tier hit rates for every league format — keyed by LeagueFormat,
   *  then by "${position}:${tier}". Computed server-side from the full
   *  historical pool; see app/mock-draft/page.tsx. */
  tierHitRatesByFormat: Record<string, Record<string, number | null>>;
}) {
  const [classYear, setClassYear] = useState<string>(defaultClassYear);
  const availableClassYears = useMemo(
    () => Object.keys(classProspectsByYear).sort((a, b) => Number(a) - Number(b)),
    [classProspectsByYear]
  );
  const initialProspects = useMemo(
    () => classProspectsByYear[classYear] ?? [],
    [classProspectsByYear, classYear]
  );
  // Future/devy classes (no real NFL draft has happened yet) have no
  // Community Rankings source and no DD Score — see getScoreForFormat's
  // Pre-Draft Score fallback in lib/mockDraft.ts for the scoring side.
  const isPreDraftClass = initialProspects.length > 0 && initialProspects.every((p) => p.hasDraftData !== true);

  const [mode, setMode] = useState<"new" | "existing" | null>(null);
  const [step, setStep] = useState<"setup" | "draft" | "results">("setup");
  // Reported directly: once a draft finished, the board itself became
  // completely unreachable — step === "results" short-circuits to a
  // separate recap screen before the board's own JSX ever renders.
  // The board is driven entirely by the picks array regardless of
  // step, and every pick-making interaction on it (canPick, isUserTurn)
  // already correctly evaluates to false once every pick number has
  // been used — deriveIsUserTurn in lib/mockDraft.ts returns false for
  // any currentOverall beyond the user's fixed set of pick numbers.
  // That means simply letting the board render after completion is
  // safely read-only already, with no risk of a new pick being made;
  // this toggle is the only piece that was actually missing.
  const [viewingBoardAfterComplete, setViewingBoardAfterComplete] = useState(false);

  // Broadcasts to BottomTabBar, which lives in the root layout —
  // outside this component's own tree, so it can't read `step`
  // directly. Cleared on unmount so navigating away from /mock-draft
  // never leaves a stale "setup" signal behind for some other route.
  useEffect(() => {
    setMockDraftStep(step);
    return () => setMockDraftStep(null);
  }, [step]);
  const { user } = useAuth();
  const [syncedNeeds, setSyncedNeeds] = useState<SyncedTeamNeeds | null>(null);
  // Reported directly: Need badges and Best-Fit suggestions were
  // showing up even for someone who never asked to use their synced
  // team for this specific draft. The underlying fetch (a few lines
  // below) was never actually gated by anything beyond "is this user
  // logged in" — if they'd ever connected a Sleeper team via Team
  // Sync at any point, every mock draft they ran afterward silently
  // used it, with no per-draft way to say "not for this one." This
  // defaults to true (matches the existing behavior for anyone who
  // hasn't complained about it) but gives an explicit opt-out in the
  // setup banner below. activeSyncedNeeds, not raw syncedNeeds, is
  // what every recommendation/suggestion feature reads from now — the
  // setup banner itself still reads raw syncedNeeds, since "you are
  // connected, but not using it right now" is a more honest thing to
  // tell someone than pretending they were never connected at all.
  // Was two separate toggles — "Use my team needs" and "Use real
  // pick order" — both tied to the same Team Sync connection, but
  // independently switchable, which meant a user could end up in an
  // ambiguous state (needs badges active, turn order still generic,
  // or vice versa) that didn't map to anything they'd deliberately
  // chosen. Reported directly: this should be one switch, either
  // both on or both off. Defaulting to false, not true — real pick
  // order changes the team-count preset and turn order itself (a
  // structural effect, not just badges), and that was deliberately
  // never a silent default before merging; the more conservative of
  // the two original defaults is the one that should survive the
  // merge, not the less consequential one.
  const [useSyncedNeedsForDraft, setUseSyncedNeedsForDraft] = useState(false);
  const activeSyncedNeeds = useSyncedNeedsForDraft ? syncedNeeds : null;
  const useRealPickOrder = useSyncedNeedsForDraft;
  const [realOrderLoading, setRealOrderLoading] = useState(false);
  const [realOrderPicks, setRealOrderPicks] = useState<
    { overall: number; round: number; slot: number; teamName: string; isUser: boolean }[] | null
  >(null);
  // Set when the real draft order genuinely can't be known yet — a
  // rookie class's slot order comes from the FULL FINAL standings of
  // the season right before it, which doesn't exist until that
  // season actually concludes. See the "draft-order" action in
  // app/api/sleeper/route.ts for the exact check.
  const [realOrderNotDetermined, setRealOrderNotDetermined] = useState<{ leagueSeason: string; leagueStatus: string } | null>(null);

  useEffect(() => {
    if (!useRealPickOrder || !syncedNeeds) {
      setRealOrderPicks(null);
      setRealOrderNotDetermined(null);
      return;
    }
    setRealOrderLoading(true);
    setRealOrderNotDetermined(null);
    fetch(
      `/api/sleeper?action=draft-order&leagueId=${syncedNeeds.leagueId}&rosterId=${syncedNeeds.rosterId}&season=${classYear}&rounds=4`
    )
      .then((res) => res.json())
      .then((data: { teams?: number; picks?: typeof realOrderPicks; notDetermined?: boolean; leagueSeason?: string; leagueStatus?: string }) => {
        if (data.notDetermined) {
          setRealOrderPicks(null);
          setRealOrderNotDetermined({ leagueSeason: data.leagueSeason ?? "", leagueStatus: data.leagueStatus ?? "unknown" });
          return;
        }
        if (!data.picks) return;
        setRealOrderPicks(data.picks);
        if (data.teams && (data.teams === 8 || data.teams === 10 || data.teams === 12 || data.teams === 14 || data.teams === 16)) {
          setTeams(data.teams);
        }
      })
      .catch(() => setRealOrderPicks(null))
      .finally(() => setRealOrderLoading(false));
  }, [useRealPickOrder, syncedNeeds, classYear]);

  // The set of overall pick numbers that are actually the synced
  // user's, after real trades — replaces the simple "I pick from
  // slot N every round" assumption everywhere it matters below.
  const userPickNumbers = useMemo(() => {
    if (!realOrderPicks) return null;
    return new Set(realOrderPicks.filter((p) => p.isUser).map((p) => p.overall));
  }, [realOrderPicks]);
  useEffect(() => {
    if (!user) return;
    // Uses whichever synced team was touched most recently (the
    // "saved" list is ordered newest-first) — this account-backed
    // sync is what Team Sync now persists, replacing the old
    // per-browser localStorage version of this same feature.
    fetch("/api/sleeper?action=saved")
      .then((res) => res.json())
      .then((data) => {
        const mostRecent = data.teams?.[0];
        if (!mostRecent) return;
        return fetch(`/api/sleeper?action=needs&leagueId=${mostRecent.leagueId}&rosterId=${mostRecent.rosterId}`)
          .then((res) => res.json())
          .then((needsData) => {
            if (!needsData.needs) return;
            const needs: PositionNeedSnapshot[] = needsData.needs.map((n: { position: string; needScore: number }) => ({
              position: n.position,
              needScore: n.needScore,
            }));
            const detectedQbFormat: MockQBFormat = needsData.format === "SUPERFLEX" ? "SUPERFLEX" : "1QB";
            const detectedTeFormat: MockTEFormat = needsData.teFormat === "TEP" ? "TEP" : "STANDARD";
            setSyncedNeeds({
              leagueName: needsData.leagueName,
              teamName: needsData.teamName,
              leagueId: mostRecent.leagueId,
              rosterId: mostRecent.rosterId,
              needs,
              bpaMode: needs.every((n) => n.needScore <= 0),
              qbFormat: detectedQbFormat,
              teFormat: detectedTeFormat,
            });
            // Applied automatically, not just stored for later — a
            // synced draft should default to matching the real
            // league's actual scoring, not whatever format happened
            // to be selected before syncing.
            setQbFormat(detectedQbFormat);
            setTeFormat(detectedTeFormat);
          });
      })
      .catch(() => {});
  }, [user]);
  const [teams, setTeams] = useState<MockLeagueSize>(12);
  const [qbFormat, setQbFormat] = useState<MockQBFormat>("SUPERFLEX");
  const [teFormat, setTeFormat] = useState<MockTEFormat>("STANDARD");

  // Keep a fresh mock aligned with the same site-wide format preference as
  // rankings, profiles, comparison and analytics. A synced league is still
  // allowed to override this later because matching the user's actual room is
  // more important than a generic preference.
  useEffect(() => {
    if (syncedNeeds) return;
    const preferred = getGlobalFormat();
    setQbFormat(preferred === "SUPERFLEX" || preferred === "SUPERFLEX_TEP" ? "SUPERFLEX" : "1QB");
    setTeFormat(preferred === "1QB_TEP" || preferred === "SUPERFLEX_TEP" ? "TEP" : "STANDARD");
  }, [syncedNeeds]);

  const updateQbFormat = (next: MockQBFormat) => {
    setQbFormat(next);
    reportFormatUsed(next === "SUPERFLEX" ? (teFormat === "TEP" ? "SUPERFLEX_TEP" : "SUPERFLEX") : (teFormat === "TEP" ? "1QB_TEP" : "1QB"));
  };

  const updateTeFormat = (next: MockTEFormat) => {
    setTeFormat(next);
    reportFormatUsed(qbFormat === "SUPERFLEX" ? (next === "TEP" ? "SUPERFLEX_TEP" : "SUPERFLEX") : (next === "TEP" ? "1QB_TEP" : "1QB"));
  };
  const [slot, setSlot] = useState(1);
  const [engine, setEngine] = useState<MockEngine>("DD");
  const [pickTimer, setPickTimer] = useState<MockPickTimer>("UNTIMED");
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [picks, setPicks] = useState<MockPick[]>([]);
  const [availableIds, setAvailableIds] = useState<Set<string>>(
    () => new Set(initialProspects.map((p) => p.id))
  );
  // Keep synchronous mirrors of the draft state so delayed computer/timer
  // callbacks cannot act on a stale render after a pick, reset, or completion.
  // This is intentionally scoped to the draft engine; it does not change
  // ranking, scoring, or draft-selection logic.
  const picksRef = useRef<MockPick[]>([]);
  const availableIdsRef = useRef<Set<string>>(new Set(initialProspects.map((p) => p.id)));
  const stepRef = useRef<"setup" | "draft" | "results">("setup");
  const draftSessionRef = useRef(0);

  useEffect(() => {
    picksRef.current = picks;
    availableIdsRef.current = availableIds;
    stepRef.current = step;
  }, [picks, availableIds, step]);
  // A canonical route refresh updates initialProspects in place. Preserve the
  // draft's picked IDs, but rebuild availability from the newest class so
  // score changes and newly added/removed prospects cannot leave a static
  // board behind during a long mock session.
  useEffect(() => {
    const liveIds = new Set(initialProspects.map((p) => p.id));
    const pickedIds = new Set(picks.map((pick) => pick.playerId));
    const next = new Set<string>();
    for (const id of liveIds) {
      if (!pickedIds.has(id)) next.add(id);
    }
    setAvailableIds(next);
  }, [initialProspects, picks]);
  const [existingPickIndex, setExistingPickIndex] = useState(0);
  const [existingPlayerSearch, setExistingPlayerSearch] = useState("");
  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState<"ALL" | "QB" | "RB" | "WR" | "TE" | "SUGGESTED">("ALL");
  const [community, setCommunity] = useState<Map<string, CommunityPlayer>>(new Map());
  const [communitySource, setCommunitySource] = useState<string>("loading");
  const [computerThinking, setComputerThinking] = useState(false);
  const [expandedPick, setExpandedPick] = useState<number | null>(null);
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const [mobilePlayerTab, setMobilePlayerTab] = useState<"available" | "queue" | "team">("available");
  // The available-player list uses one native horizontal scroller;
  // the identity column itself stays sticky rather than switching
  // layouts at a scroll threshold.
  // Search used to be a persistently-visible full-width bar taking
  // its own row above the filters, all the time — reported directly
  // as consuming too much space before the list itself starts.
  // Collapsed by default now; the icon in the tab row reveals it only
  // when actually needed.
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const closePlayerSearch = useCallback(() => {
    setSearch("");
    setSearchOpen(false);
    searchInputRef.current?.blur();
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    const frame = window.requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [searchOpen]);
  // A player's own ID is enough to identify them in the queue — order
  // in the array IS the queue order, so no separate priority field is
  // needed. Genuinely new: confirmed nothing like this existed
  // anywhere in the mock draft before this. Kept entirely local to
  // this draft session (not persisted/synced anywhere) since a queue
  // is inherently specific to one draft's context, not something that
  // should carry over or sync across different drafts.
  const [queue, setQueue] = useState<string[]>([]);
  const toggleQueued = useCallback((playerId: string) => {
    setQueue((prev) => (prev.includes(playerId) ? prev.filter((id) => id !== playerId) : [...prev, playerId]));
  }, []);
  const [mobilePlayersExpanded, setMobilePlayersExpanded] = useState(false);
  const mobileSheetTouchStart = useRef<number | null>(null);
  const draftBoardScrollRef = useRef<HTMLDivElement | null>(null);
  const lastSnappedUserRoundRef = useRef<number | null>(null);

  const settings: MockSettings = useMemo(
    () => ({ teams, qbFormat, teFormat, slot, engine, pickTimer }),
    [teams, qbFormat, teFormat, slot, engine, pickTimer]
  );

  const ddRankMap = useMemo(() => {
    const format: LeagueFormat = qbFormat === "SUPERFLEX"
      ? (teFormat === "TEP" ? "SUPERFLEX_TEP" : "SUPERFLEX")
      : (teFormat === "TEP" ? "1QB_TEP" : "1QB");
    return buildRanksWithinCollection(initialProspects, format);
  }, [initialProspects, qbFormat, teFormat]);

  const computerPickInFlight = useRef(false);
  const computerTimerRef = useRef<number | null>(null);
  const pickTimerIntervalRef = useRef<number | null>(null);
  const autoPickInFlight = useRef(false);
  const latestAvailableRef = useRef<Prospect[]>([]);
  const latestCommunityRef = useRef<Map<string, CommunityPlayer>>(new Map());
  const latestSettingsRef = useRef<MockSettings>(settings);

  const sortedProspects = useMemo(() => {
    return [...initialProspects].sort((a, b) => {
      const ar = ddRankMap.get(a.id) ?? 9999;
      const br = ddRankMap.get(b.id) ?? 9999;
      if (ar !== br) return ar - br;
      return (getScoreForFormat(b, qbFormat, teFormat) ?? -1) - (getScoreForFormat(a, qbFormat, teFormat) ?? -1);
    });
  }, [initialProspects, qbFormat, teFormat, ddRankMap]);

  const prospectById = useMemo(() => new Map(initialProspects.map((p) => [p.id, p])), [initialProspects]);
  // Real tier hit rates, matching whichever league format is currently
  // selected in the mock draft settings — the same numbers the
  // Analytics page's Tier Hit Rate chart shows for that format.
  const currentFormatKey: LeagueFormat = qbFormat === "SUPERFLEX"
    ? (teFormat === "TEP" ? "SUPERFLEX_TEP" : "SUPERFLEX")
    : (teFormat === "TEP" ? "1QB_TEP" : "1QB");
  const positionTierHitRates = useMemo(() => {
    const rows = tierHitRatesByFormat[currentFormatKey] ?? {};
    const entries = Object.entries(rows).filter(
      (entry): entry is [string, number] => entry[1] !== null
    );
    return new Map(entries);
  }, [tierHitRatesByFormat, currentFormatKey]);
  const available = useMemo(
    () => sortedProspects.filter((p) => availableIds.has(p.id)),
    [sortedProspects, availableIds]
  );


  const currentOverall = picks.length + 1;
  const currentSlot = ((currentOverall - 1) % teams) + 1;
  const currentRound = Math.floor((currentOverall - 1) / teams) + 1;
  // See deriveIsUserTurn/deriveManualEntryLimit in lib/mockDraft.ts —
  // extracted there specifically so this logic (which has already
  // had one real shipped bug) is unit-testable in isolation.
  // deriveIsUserTurn only checks whether currentOverall falls within
  // the user's fixed set of pick numbers — it has no way to know the
  // draft actually ended, since userPickNumbers is computed once for
  // the full configured length and isn't re-adjusted if the draft
  // terminated earlier (e.g. the player pool ran out before every
  // configured round finished). Reported directly, with a screenshot:
  // viewing the board after completion still showed "On the clock /
  // Your pick: 5.01" with live Pick buttons, because pick 49 (5.01)
  // still happened to fall inside the user's pre-computed set even
  // though draftComplete was already true. This was a real,
  // pre-existing gap — previously unreachable because the results
  // screen short-circuited before this code path could ever render;
  // the "view board after completion" feature simply exposed it.
  // Fixing it here, not by patching each "on the clock" display
  // individually, means every downstream usage (both the mobile and
  // desktop headers, and canPick) inherits the correct behavior from
  // one place instead of needing the same fix applied N times.
  //
  // MAX_ROUNDS and draftComplete moved above isUserTurn — they were
  // previously declared below it, which would have made referencing
  // draftComplete here a genuine runtime ReferenceError (a `const`
  // accessed before its own declaration, JavaScript's temporal dead
  // zone). Caught and fixed before this ever shipped.
  const MAX_ROUNDS = 4;
  const draftComplete = currentOverall > Math.min(initialProspects.length, teams * MAX_ROUNDS);
  const isUserTurn = !draftComplete && deriveIsUserTurn(currentOverall, currentSlot, slot, userPickNumbers);
  // Keep the turn state synchronously available to click handlers. React state
  // does not rerender between rapid clicks, so relying only on the rendered
  // `isUserTurn` value would allow a user to fire multiple picks before the
  // first state update is reflected in the UI.
  const isUserTurnRef = useRef(isUserTurn);
  isUserTurnRef.current = isUserTurn;
  const manualEntryLimit = deriveManualEntryLimit(userPickNumbers, slot);
  const maxPicks = Math.min(initialProspects.length, teams * MAX_ROUNDS);

  useEffect(() => {
    if (step === "draft" && !draftComplete && isUserTurn) playOnClockSound();
  }, [step, draftComplete, isUserTurn]);

  useEffect(() => {
    latestAvailableRef.current = available;
    latestCommunityRef.current = community;
    latestSettingsRef.current = settings;
  }, [available, community, settings]);

  // When the user reaches the clock for a new round, bring their team column
  // into view automatically. The board remains freely horizontally scrollable
  // after this initial snap.
  useEffect(() => {
    if (step !== "draft" || !isUserTurn || lastSnappedUserRoundRef.current === currentRound) return;
    const board = draftBoardScrollRef.current;
    if (!board) return;

    const snapToUserColumn = () => {
      const columnWidth = board.scrollWidth / teams;
      const desired = ((slot - 0.5) * columnWidth) - (board.clientWidth / 2);
      const maxScroll = Math.max(0, board.scrollWidth - board.clientWidth);
      board.scrollTo({ left: Math.max(0, Math.min(desired, maxScroll)), behavior: "smooth" });
      lastSnappedUserRoundRef.current = currentRound;
    };

    requestAnimationFrame(snapToUserColumn);
  }, [step, isUserTurn, currentRound, slot, teams]);

  useEffect(() => {
    if (step === "draft") {
      document.documentElement.classList.add("mock-draft-active");
      document.body.classList.add("mock-draft-active");
    } else {
      document.documentElement.classList.remove("mock-draft-active");
      document.body.classList.remove("mock-draft-active");
    }
    return () => {
      document.documentElement.classList.remove("mock-draft-active");
      document.body.classList.remove("mock-draft-active");
    };
  }, [step]);

  // Selecting a class in setup resets the pool of available players to
  // match it. This never fires mid-draft, since classYear can't change
  // once step leaves "setup".
  useEffect(() => {
    if (step === "setup") setAvailableIds(new Set(initialProspects.map((p) => p.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classYear]);

  // Community Rankings has no source for future/devy classes, and the
  // engine is forced to "DD" for them below — skip the fetch entirely.
  useEffect(() => {
    if (isPreDraftClass && engine === "COMMUNITY") setEngine("DD");
  }, [isPreDraftClass, engine]);

  useEffect(() => {
    if (step !== "draft" || isPreDraftClass) return;
    let cancelled = false;
    setCommunitySource("loading");
    fetch(`/api/mock-draft/community?class=${encodeURIComponent(classYear)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const formatKey = getCommunityFormatKey(qbFormat, teFormat);
        const selected = data.rankings?.[formatKey]?.players ?? {};

        const exact = new Map<string, CommunityPlayer>();
        const loose = new Map<string, CommunityPlayer>();
        for (const [name, value] of Object.entries(selected) as Array<[string, CommunityPlayer]>) {
          const normalized = normalizePlayerName(name);
          exact.set(normalized, value);
          const looseKey = communityLookupKey(name);
          if (looseKey) loose.set(looseKey, value);
        }

        // Scope the community board to the active rookie class, then rank the
        // matched players from #1. This keeps the Community Rank shown in the
        // mock specific to the selected class instead of FantasyCalc's full
        // dynasty player pool. TEP is applied as a percentile bump to the
        // class-scoped board before re-ranking.
        const matched = initialProspects
          .map((prospect) => {
            const normalized = normalizePlayerName(prospect.name);
            const looseKey = communityLookupKey(prospect.name);
            const value = exact.get(normalized) ?? loose.get(looseKey);
            return value ? { prospect, normalized, value } : null;
          })
          .filter((row): row is { prospect: Prospect; normalized: string; value: CommunityPlayer } => !!row)
          .sort((a, b) => (a.value.sourceRank ?? a.value.rank ?? 999999) - (b.value.sourceRank ?? b.value.rank ?? 999999));

        const classTotal = matched.length;
        const teAdjusted = matched
          .map((row, index) => {
            const basePct = classTotal <= 1 ? 100 : ((classTotal - index) / classTotal) * 100;
            const pct = teFormat === "TEP" && row.prospect.position === "TE"
              ? Math.min(100, basePct + 3)
              : basePct;
            return { ...row, pct };
          })
          .sort((a, b) => {
            if (teFormat === "TEP" && b.pct !== a.pct) return b.pct - a.pct;
            return (a.value.sourceRank ?? a.value.rank ?? 999999) - (b.value.sourceRank ?? b.value.rank ?? 999999);
          });

        const map = new Map<string, CommunityPlayer>();
        teAdjusted.forEach((row, index) => {
          const base = row.value;
          const tier = row.pct >= 95 ? 1
            : row.pct >= 85 ? 2
            : row.pct >= 75 ? 3
            : row.pct >= 62.5 ? 4
            : row.pct >= 50 ? 5
            : row.pct >= 37.5 ? 6
            : row.pct >= 25 ? 7
            : 8;
          map.set(row.normalized, { ...base, rank: index + 1, tier, eligibleYear: classYear });
        });
        setCommunity(map);
        setCommunitySource(data.source === "fantasycalc" && map.size > 0 ? "fantasycalc" : "unavailable");
      })
      .catch(() => {
        if (!cancelled) setCommunitySource("unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [classYear, initialProspects, qbFormat, teFormat, step, isPreDraftClass]);

  const resetDraft = useCallback(() => {
    draftSessionRef.current += 1;
    picksRef.current = [];
    availableIdsRef.current = new Set(initialProspects.map((p) => p.id));
    stepRef.current = "setup";
    setStep("setup");
    setMode(null);
    setPicks([]);
    setAvailableIds(new Set(initialProspects.map((p) => p.id)));
    setExistingPickIndex(0);
    setExistingPlayerSearch("");
    setSearch("");
    setPositionFilter("ALL");
    setComputerThinking(false);
    setExpandedPick(null);
    setExpandedPlayerId(null);
    setMobilePlayerTab("available");
    setMobilePlayersExpanded(false);
    setPaused(false);
    setViewingBoardAfterComplete(false);
    setQueue([]);
    if (computerTimerRef.current !== null) {
      window.clearTimeout(computerTimerRef.current);
      computerTimerRef.current = null;
    }
    computerPickInFlight.current = false;
    if (pickTimerIntervalRef.current !== null) {
      window.clearInterval(pickTimerIntervalRef.current);
      pickTimerIntervalRef.current = null;
    }
    autoPickInFlight.current = false;
    setRemainingSeconds(null);
  }, [initialProspects]);

  const makePick = useCallback(
    (player: Prospect, userPick: boolean) => {
      // Delayed callbacks can outlive the render that scheduled them.
      // Validate against synchronous refs first so a timer that fires during
      // a reset/completion can never mutate a new draft session.
      if (stepRef.current !== "draft") return;
      // A user Pick is only valid while the current draft slot belongs to
      // the user. This must be checked synchronously because rapid clicks
      // can arrive before React has committed the next render.
      if (userPick && !isUserTurnRef.current) return;

      const currentPicks = picksRef.current;
      const currentOverallNow = currentPicks.length + 1;
      if (currentOverallNow > maxPicks || !availableIdsRef.current.has(player.id)) return;

      const currentSlotNow = ((currentOverallNow - 1) % teams) + 1;
      const currentRoundNow = Math.floor((currentOverallNow - 1) / teams) + 1;
      const pick: MockPick = {
        overall: currentOverallNow,
        round: currentRoundNow,
        slot: currentSlotNow,
        playerId: player.id,
        userPick,
      };

      const nextPicks = [...currentPicks, pick];
      const nextAvailableIds = new Set(availableIdsRef.current);
      nextAvailableIds.delete(player.id);
      picksRef.current = nextPicks;
      availableIdsRef.current = nextAvailableIds;

      // Advance the synchronous turn guard immediately. This closes the
      // same-render double-click window even before React processes setPicks.
      if (userPick) {
        const nextOverall = currentOverallNow + 1;
        const nextSlot = ((nextOverall - 1) % teams) + 1;
        const nextIsUserTurn = nextOverall <= maxPicks && deriveIsUserTurn(
          nextOverall,
          nextSlot,
          slot,
          userPickNumbers
        );
        isUserTurnRef.current = nextIsUserTurn;
      }

      setPicks(nextPicks);
      setAvailableIds(nextAvailableIds);
      // A queued player who gets drafted by anyone else — not just the
      // user — needs to come out of the queue too; setQueue is a
      // stable state setter (React guarantees this), so it doesn't
      // need to be in the dependency array below.
      setQueue((prev) => prev.filter((id) => id !== player.id));
      playPickSound();
    },
    [maxPicks, slot, teams, userPickNumbers]
  );

  useEffect(() => {
    const communityReady = engine !== "COMMUNITY" || community.size > 0 || communitySource === "unavailable";
    const needsComputer =
      step === "draft" &&
      !draftComplete &&
      !isUserTurn &&
      !paused &&
      available.length > 0 &&
      communityReady &&
      // The slot-based "still replaying history" gate only makes
      // sense under the simple single-slot model — with real pick
      // order active, isUserTurn above already correctly reflects
      // actual (possibly non-contiguous) ownership, so this gate is
      // simply bypassed rather than needing an equivalent threshold
      // for a pattern that might not have one.
      !(mode === "existing" && !userPickNumbers && existingPickIndex < slot - 1);

    if (!needsComputer) {
      // Cancel a pending computer pick cleanly if we paused (or the turn/step
      // changed) mid-timer, so a stale pick can't fire later and the effect
      // can restart fresh once conditions are met again.
      if (computerTimerRef.current !== null) {
        window.clearTimeout(computerTimerRef.current);
        computerTimerRef.current = null;
        computerPickInFlight.current = false;
        setComputerThinking(false);
      }
      return;
    }

    if (computerPickInFlight.current || computerTimerRef.current !== null) return;

    computerPickInFlight.current = true;
    setComputerThinking(true);
    const session = draftSessionRef.current;

    computerTimerRef.current = window.setTimeout(() => {
      computerTimerRef.current = null;
      if (session !== draftSessionRef.current || stepRef.current !== "draft") {
        computerPickInFlight.current = false;
        setComputerThinking(false);
        return;
      }
      try {
        const availableNow = latestAvailableRef.current;
        if (!availableNow.length) return;
        const choice = weightedRandomPick(
          availableNow,
          latestSettingsRef.current,
          latestCommunityRef.current,
          currentOverall,
          ddRankMap
        );
        makePick(choice, false);
      } catch {
        // Keep the draft alive even if a remote ranking snapshot is malformed.
        const fallback = latestAvailableRef.current[0];
        if (fallback) makePick(fallback, false);
      } finally {
        computerPickInFlight.current = false;
        setComputerThinking(false);
      }
    }, 650);

    return () => {
      if (computerTimerRef.current !== null) {
        window.clearTimeout(computerTimerRef.current);
        computerTimerRef.current = null;
        computerPickInFlight.current = false;
      }
    };
  }, [available.length, community.size, communitySource, currentOverall, ddRankMap, draftComplete, engine, existingPickIndex, isUserTurn, makePick, mode, paused, slot, step, userPickNumbers]);

  // Resets the countdown value only when a genuinely new user turn begins —
  // NOT when pausing/resuming, so a pause can't secretly refill the clock.
  useEffect(() => {
    autoPickInFlight.current = false;
    if (step !== "draft" || draftComplete || !isUserTurn || pickTimer === "UNTIMED") {
      setRemainingSeconds(null);
      return;
    }
    setRemainingSeconds(pickTimer);
  }, [step, isUserTurn, currentOverall, pickTimer, draftComplete]);

  // Starts/stops the actual ticking interval. Pausing stops it in place —
  // resuming continues counting down from wherever it left off, rather
  // than restarting the clock. The computer's own picks are unaffected by
  // this — they're paced by the fixed short delay in the effect above,
  // "as quick as it can".
  useEffect(() => {
    if (pickTimerIntervalRef.current !== null) {
      window.clearInterval(pickTimerIntervalRef.current);
      pickTimerIntervalRef.current = null;
    }

    if (step !== "draft" || draftComplete || !isUserTurn || pickTimer === "UNTIMED" || paused) {
      return;
    }

    const session = draftSessionRef.current;
    pickTimerIntervalRef.current = window.setInterval(() => {
      if (session !== draftSessionRef.current || stepRef.current !== "draft") {
        if (pickTimerIntervalRef.current !== null) {
          window.clearInterval(pickTimerIntervalRef.current);
          pickTimerIntervalRef.current = null;
        }
        return;
      }
      setRemainingSeconds((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          if (pickTimerIntervalRef.current !== null) {
            window.clearInterval(pickTimerIntervalRef.current);
            pickTimerIntervalRef.current = null;
          }
          if (!autoPickInFlight.current) {
            autoPickInFlight.current = true;
            // Highest-ranked remaining player by DD Score — available is
            // already sorted by DD rank, so the first entry is the pick.
            const best = latestAvailableRef.current[0];
            if (best) makePick(best, true);
          }
          return 0;
        }
        const next = prev - 1;
        if (next <= 10) playTickSound();
        return next;
      });
    }, 1000);

    return () => {
      if (pickTimerIntervalRef.current !== null) {
        window.clearInterval(pickTimerIntervalRef.current);
        pickTimerIntervalRef.current = null;
      }
    };
  }, [step, isUserTurn, pickTimer, draftComplete, paused, makePick]);

  useEffect(() => {
    return () => {
      if (pickTimerIntervalRef.current !== null) {
        window.clearInterval(pickTimerIntervalRef.current);
        pickTimerIntervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (computerTimerRef.current !== null) {
        window.clearTimeout(computerTimerRef.current);
        computerTimerRef.current = null;
      }
      computerPickInFlight.current = false;
    };
  }, []);

  useEffect(() => {
    if (step === "draft" && picks.length >= maxPicks) setStep("results");
  }, [maxPicks, picks.length, step]);

  // Positions the user has actually drafted so far this mock — used
  // by isPositionStillSuggested below to let the "Suggested" tab
  // evolve as the draft goes, instead of staying frozen at whatever
  // Team Sync said before the draft started.
  const userPositionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const pick of picks) {
      if (!pick.userPick) continue;
      const player = prospectById.get(pick.playerId);
      if (player) counts[player.position] = (counts[player.position] ?? 0) + 1;
    }
    return counts;
  }, [picks, prospectById]);

  const filteredAvailable = useMemo(() => {
    const q = search.trim().toLowerCase();
    return available.filter((p) => {
      if (positionFilter === "SUGGESTED") {
        if (!activeSyncedNeeds) return false;
        // BPA mode: no position restriction at all — `available` is
        // already ranked, so this just shows the best players overall.
        if (!activeSyncedNeeds.bpaMode && !isPositionStillSuggested(p.position, activeSyncedNeeds, userPositionCounts)) {
          return false;
        }
      } else if (positionFilter !== "ALL" && p.position !== positionFilter) {
        return false;
      }
      if (!q) return true;
      return `${p.name} ${p.school ?? ""}`.toLowerCase().includes(q);
    });
  }, [available, positionFilter, search, activeSyncedNeeds, userPositionCounts]);

  const existingCandidates = useMemo(() => {
    const q = existingPlayerSearch.trim().toLowerCase();
    return sortedProspects.filter((p) => !picks.some((pick) => pick.playerId === p.id) && (!q || p.name.toLowerCase().includes(q))).slice(0, 12);
  }, [existingPlayerSearch, picks, sortedProspects]);

  const selectNewDraft = () => setMode("new");
  const selectExistingDraft = () => setMode("existing");

  const startSelectedDraft = () => {
    if (!mode) return;
    draftSessionRef.current += 1;
    picksRef.current = [];
    availableIdsRef.current = new Set(initialProspects.map((p) => p.id));
    stepRef.current = "draft";
    track("mock_draft_started", "/mock-draft");
    setPicks([]);
    setAvailableIds(new Set(initialProspects.map((p) => p.id)));
    setExistingPickIndex(0);
    setExistingPlayerSearch("");
    setSearch("");
    setExpandedPick(null);
    setExpandedPlayerId(null);
    setMobilePlayerTab("available");
    setMobilePlayersExpanded(false);
    setComputerThinking(false);
    computerPickInFlight.current = false;
    setPaused(false);
    setStep("draft");
  };

  const enterExistingPick = (player: Prospect) => {
    if (existingPickIndex >= maxPicks || !availableIds.has(player.id)) return;
    const overall = existingPickIndex + 1;
    const round = Math.floor(existingPickIndex / teams) + 1;
    const pickSlot = (existingPickIndex % teams) + 1;
    setPicks((prev) => [...prev, { overall, round, slot: pickSlot, playerId: player.id, userPick: deriveIsUserTurn(overall, pickSlot, slot, userPickNumbers) }]);
    setAvailableIds((prev) => {
      const next = new Set(prev);
      next.delete(player.id);
      return next;
    });
    setExistingPickIndex((v) => v + 1);
    setExistingPlayerSearch("");
  };

  const startFromExisting = () => {
    setStep("draft");
  };

  const runRemainingExisting = () => {
    setMode("existing");
    setStep("draft");
    // The existing-pick entry UI is intentionally followed by the same live
    // draft board. From the user's next pick onward, the normal engine takes over.
  };

  // Filters on the flag recorded when each pick was made, not on
  // p.slot === slot. The slot comparison assumed "I pick from the same
  // slot every round", which is wrong for a synced league: someone who
  // owns only 1.06 was shown the players taken at 1.01/2.01/3.01/4.01
  // instead of their own pick. deriveIsUserTurn (the single source of
  // truth for whose turn it is, and what sets this flag) already
  // accounts for real, traded pick ownership.
  const userPicks = picks.filter((p) => p.userPick).map((p) => prospectById.get(p.playerId)).filter(Boolean) as Prospect[];

  const gradeRows = useMemo(() => {
    const rows: Array<{ pick: MockPick; player: Prospect; grade: string; valueGain: number; scoreGap: number; tierGap: number }> = [];
    // Same reasoning as userPicks above — the grade has to be built
    // from the picks actually owned, not from one repeated slot.
    for (const pick of picks.filter((p) => p.userPick)) {
      const player = prospectById.get(pick.playerId);
      if (!player) continue;
      const expectedPlayer = sortedProspects[pick.overall - 1];
      const expectedScore = expectedPlayer
        ? getScoreForFormat(expectedPlayer, settings.qbFormat, settings.teFormat)
        : undefined;
      const result = getPickGrade(player, expectedScore, settings);
      rows.push({ pick, player, ...result });
    }
    return rows;
  }, [picks, prospectById, settings, sortedProspects]);

  const overallGrade = useMemo(() => {
    if (!gradeRows.length) return "—";
    const totalGain = gradeRows.reduce((sum, row) => sum + row.valueGain, 0);
    const avgGain = totalGain / gradeRows.length;
    const worstGain = Math.min(...gradeRows.map((row) => row.valueGain));

    // A full-draft grade rewards total value gained and consistency.
    // A negative total value can never receive better than an A-.
    // A+ requires meaningful positive value on average AND no major value miss.
    if (totalGain < 0) {
      if (avgGain >= -1) return "A-";
      if (avgGain >= -2.5) return "B+";
      if (avgGain >= -4) return "B";
      if (avgGain >= -6) return "B-";
      if (avgGain >= -8) return "C+";
      if (avgGain >= -12) return "C";
      if (avgGain >= -16) return "C-";
      if (avgGain >= -20) return "D";
      return "F";
    }

    if (avgGain >= 2.5 && worstGain >= -2.5) return "A+";
    if (avgGain >= 1) return "A";
    if (avgGain >= 0) return "A-";
    if (avgGain >= -1) return "A-";
    if (avgGain >= -2.5) return "B";
    if (avgGain >= -4) return "B-";
    if (avgGain >= -6) return "C+";
    if (avgGain >= -8) return "C";
    if (avgGain >= -12) return "C-";
    if (avgGain >= -16) return "D";
    return "F";
  }, [gradeRows]);

  const ddValueCaptured = useMemo(() => {
    if (!gradeRows.length) return 0;
    let actual = 0;
    let optimal = 0;
    for (const row of gradeRows) {
      actual += getScoreForFormat(row.player, qbFormat, teFormat) ?? 0;
      const availableAtPick = initialProspects.filter((p) => {
        const prior = picks.find((x) => x.playerId === p.id);
        return !prior || prior.overall > row.pick.overall;
      });
      optimal += Math.max(...availableAtPick.map((p) => getScoreForFormat(p, qbFormat, teFormat) ?? 0), 0);
    }
    return optimal ? Math.min(100, (actual / optimal) * 100) : 0;
  }, [gradeRows, initialProspects, picks, qbFormat, teFormat]);



  if (!initialProspects.length) {
    return (
      <div className="border border-border bg-surface p-8 text-center">
        <p className="font-mono text-xs uppercase tracking-widest2 text-ink-tertiary">No class data</p>
        <p className="mt-2 text-sm text-ink-secondary">The {classYear} class is not currently available in the Dynasty Database data source.</p>
      </div>
    );
  }

  if (step === "setup") {
    return (
      <section className="mock-draft-setup mx-auto max-w-6xl px-0 pb-10 lg:pb-10">
        {/* Mobile clearance is supplied by the section itself; the outer page
            wrapper's generic tab-bar padding is removed for this setup page
            so the document ends a controlled distance below the CTA instead
            of creating a large, scrollable blank tail. */}
        <div className="relative mb-5 overflow-hidden border-b border-border px-4 pb-5 sm:mb-7 sm:px-0 sm:pb-6">
          <div className="relative flex items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-widest2 text-accent"><span className="h-px w-7 bg-accent" /> Mock Draft Engine</div>
              {/* The route's real <h1> — this whole page is a
                  single client component with no server-rendered
                  SectionIntro (unlike most other routes), and this
                  screen is what a fresh visitor actually sees first,
                  so it's the correct element to carry it. */}
              <h1 className="mt-3 font-headline text-3xl uppercase leading-[.9] tracking-tight text-ink sm:text-5xl">Build your draft.</h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-secondary">Set the room, choose the board, and test every decision against the same Dynasty Database grades you use everywhere else.</p>
            </div>
            <div className="hidden border border-border-strong bg-surface px-3 py-2 font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary sm:flex sm:items-center sm:gap-2">
              <span className="h-2 w-2 rounded-full bg-accent" /> {classYear} class
            </div>
          </div>
        </div>

        {!user ? (
          <div className="mb-5 flex flex-wrap items-center gap-2 border border-accent/30 bg-accent/5 px-4 py-3 text-xs text-ink-secondary sm:mb-6">
            <Link2 className="h-4 w-4 shrink-0 text-accent" />
            <span>
              <Link href="/login?redirect=/mock-draft" className="font-semibold text-accent hover:underline">Log in</Link>
              {" or "}
              <Link href="/signup?redirect=/mock-draft" className="font-semibold text-accent hover:underline">sign up</Link>
              {" to sync your Sleeper team to receive pick recommendations based on team needs."}
            </span>
          </div>
        ) : !syncedNeeds ? (
          <div className="mb-5 flex flex-wrap items-center gap-2 border border-border-strong bg-surface px-4 py-3 text-xs text-ink-secondary sm:mb-6">
            <Link2 className="h-4 w-4 shrink-0 text-ink-tertiary" />
            <span>
              <Link href="/team-sync" className="font-semibold text-accent hover:underline">Sync your Sleeper team</Link>
              {" to get picks flagged for your actual roster needs during this draft."}
            </span>
          </div>
        ) : (
          <div className="mb-5 flex flex-col gap-3 border border-accent/30 bg-accent/5 px-4 py-3 text-xs text-ink-secondary sm:mb-6">
            <div className="flex flex-wrap items-center gap-2">
              <Link2 className="h-4 w-4 shrink-0 text-accent" />
              <span>
                Synced with <span className="font-semibold text-ink">{syncedNeeds.teamName}</span>.{" "}
                {activeSyncedNeeds
                  ? activeSyncedNeeds.bpaMode
                    ? "your roster is solid everywhere, so picks will lean toward best player available."
                    : `picks at your needs (${activeSyncedNeeds.needs.filter((n) => n.needScore > 0).map((n) => n.position).join(", ")}) will be flagged during the draft, and update as you pick.`
                  : "team-needs suggestions are turned off for this draft."}
                {" "}QB format and TE premium below were set to match your league automatically.
              </span>
            </div>
            {/* Was two separate toggles for Team Sync's two effects
                (needs/Best Fit, and real pick order) — merged into
                one per direct feedback: either both are on, or both
                are off, never an ambiguous in-between state. */}
            <label className="flex cursor-pointer items-center gap-2.5 border-t border-accent/20 pt-3">
              <span className="relative inline-flex h-5 w-9 shrink-0 items-center">
                <input
                  type="checkbox"
                  checked={useSyncedNeedsForDraft}
                  onChange={(e) => setUseSyncedNeedsForDraft(e.target.checked)}
                  className="peer sr-only"
                />
                <span className="absolute inset-0 rounded-full bg-border-strong transition-colors peer-checked:bg-accent" />
                <span className="absolute left-0.5 h-4 w-4 rounded-full bg-void transition-transform peer-checked:translate-x-4" />
              </span>
              <span className="text-ink-secondary">
                <span className="font-semibold text-ink">Use {syncedNeeds.teamName} for this draft.</span> Need badges,
                Best Fit, and real pick order from {syncedNeeds.leagueName}.
                {realOrderLoading && " Loading…"}
                {useRealPickOrder && !realOrderLoading && realOrderPicks && (
                  <span className="text-riser"> Loaded: {teams} teams and {userPickNumbers?.size ?? 0} of your own picks.</span>
                )}
                {useRealPickOrder && !realOrderLoading && realOrderNotDetermined && (
                  <span className="text-[#8A6608]">
                    {" "}Not available yet. The {classYear} class&apos;s draft order depends on your league&apos;s{" "}
                    {realOrderNotDetermined.leagueSeason} season, which {
                      realOrderNotDetermined.leagueStatus === "pre_draft" ? "hasn't started"
                        : realOrderNotDetermined.leagueStatus === "drafting" ? "is still drafting"
                        : realOrderNotDetermined.leagueStatus === "in_season" ? "is still in progress"
                        : "hasn't concluded"
                    } yet. Standard slot order will be used instead.
                  </span>
                )}
              </span>
            </label>
          </div>
        )}

        <div className="grid gap-5 lg:gap-6 lg:grid-cols-[1.05fr_.95fr]">
          <div className="border border-border bg-surface p-5 sm:p-6">
            <div className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-widest2 text-ink-tertiary">
              <span className="h-5 w-5 border border-border-strong bg-surface-raised text-center leading-5 text-accent">1</span>
              League settings
            </div>
            <div className="mt-4 space-y-4 sm:mt-5 sm:space-y-5">
              {availableClassYears.length > 1 && (
                <Segment
                  label="Draft class"
                  options={availableClassYears}
                  value={classYear}
                  onChange={(v) => setClassYear(v)}
                  display={(v) => (v === defaultClassYear ? v : `${v} (devy)`)}
                />
              )}
              {useRealPickOrder && realOrderPicks ? (
                <div className="border border-accent/30 bg-accent/5 p-3">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-widest2 text-ink-tertiary">Teams</p>
                  <p className="mt-1.5 text-sm text-ink">{teams}, set by your real league</p>
                </div>
              ) : (
                <Segment label="Teams" options={[10, 12, 14]} value={teams} onChange={(v) => { setTeams(v as MockLeagueSize); setSlot(Math.min(slot, v as number)); }} />
              )}
              {useRealPickOrder && realOrderPicks ? (
                <div className="border border-accent/30 bg-accent/5 p-3">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-widest2 text-ink-tertiary">QB format</p>
                  <p className="mt-1.5 text-sm text-ink">{qbFormat === "SUPERFLEX" ? "Superflex" : "1 QB"}, set by your real league</p>
                </div>
              ) : (
                <Segment label="QB format" options={["1QB", "SUPERFLEX"]} value={qbFormat} onChange={(v) => updateQbFormat(v as MockQBFormat)} display={(v) => v === "SUPERFLEX" ? "Superflex" : "1 QB"} />
              )}
              {useRealPickOrder && realOrderPicks ? (
                <div className="border border-accent/30 bg-accent/5 p-3">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-widest2 text-ink-tertiary">TE premium</p>
                  <p className="mt-1.5 text-sm text-ink">{teFormat === "TEP" ? "TEP" : "Standard"}, set by your real league</p>
                </div>
              ) : (
                <Segment label="TE premium" options={["STANDARD", "TEP"]} value={teFormat} onChange={(v) => updateTeFormat(v as MockTEFormat)} display={(v) => v === "STANDARD" ? "Standard" : "TEP"} />
              )}
              {useRealPickOrder && realOrderPicks ? (
                <div className="border border-accent/30 bg-accent/5 p-3">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-widest2 text-ink-tertiary">Your picks</p>
                  <p className="mt-1.5 text-sm text-ink">
                    {userPickNumbers && userPickNumbers.size > 0
                      ? [...userPickNumbers].sort((a, b) => a - b).map((n) => formatPick(n, teams)).join(", ")
                      : "None found. You may not own any picks in this class."}
                  </p>
                </div>
              ) : (
                <div>
                  <label className="mb-2 block font-mono text-[10px] font-semibold uppercase tracking-widest2 text-ink-tertiary">Your draft slot</label>
                  <select value={slot} onChange={(e) => setSlot(Number(e.target.value))} className="w-full border border-border-strong bg-surface-raised px-3 py-3 text-sm text-ink outline-none focus:border-accent">
                    {Array.from({ length: teams }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n < 10 ? `1.0${n}` : `1.${n}`}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="mb-2 block font-mono text-[10px] font-semibold uppercase tracking-widest2 text-ink-tertiary">Pick timer</label>
                <select
                  value={String(pickTimer)}
                  onChange={(e) => setPickTimer(parsePickTimer(e.target.value))}
                  className="w-full border border-border-strong bg-surface-raised px-3 py-3 text-sm text-ink outline-none focus:border-accent"
                >
                  <option value="UNTIMED">Untimed</option>
                  <option value="15">15 seconds</option>
                  <option value="30">30 seconds</option>
                  <option value="45">45 seconds</option>
                  <option value="60">1 minute</option>
                  <option value="120">2 minutes</option>
                  <option value="300">5 minutes</option>
                </select>
              </div>
            </div>
          </div>

          <div className="border border-border bg-surface p-5 sm:p-6">
            <div className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-widest2 text-ink-tertiary">
              <span className="h-5 w-5 border border-border-strong bg-surface-raised text-center leading-5 text-accent">2</span>
              Draft engine
            </div>
            <div className="mt-4 grid gap-2.5 sm:mt-5 sm:gap-3">
              <EngineCard active={engine === "DD"} onClick={() => setEngine("DD")} title="Dynasty Database" short="DD" description={isPreDraftClass ? "Our live rankings, scores, tiers, and draft engine. This class uses Pre-Draft Score until real draft data is available." : "Our live rankings, scores, tiers, and draft engine."} />
              <div className={cn("relative", isPreDraftClass && "opacity-50")}>
                <EngineCard
                  active={engine === "COMMUNITY"}
                  onClick={() => { if (!isPreDraftClass) setEngine("COMMUNITY"); }}
                  title="Community Rankings"
                  short="CR"
                  description="FantasyCalc market rankings drive the computer picks (TEP formats use the site’s percentile TE adjustment)."
                />
                {isPreDraftClass && (
                  <div className="absolute inset-0 flex items-center justify-center bg-surface/75 backdrop-blur-[1px]">
                    <span className="border border-border-strong bg-surface px-3 py-1 font-mono text-[9px] font-semibold uppercase tracking-widest2 text-ink-tertiary">
                      Coming soon, no {classYear} rankings yet
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 border-t border-border pt-4 sm:mt-5 sm:pt-5">
              <div className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-widest2 text-ink-tertiary"><span className="h-5 w-5 border border-border-strong bg-surface-raised text-center leading-5 text-accent">3</span> Draft type</div>
              <div className="mt-3 grid gap-2.5 sm:gap-3">
                <DraftTypeCard active={mode === "new"} onClick={selectNewDraft} title="Start New Draft" description="Start from scratch, choose your draft slot, and practice against the Mock Draft Engine using the site's live rankings." />
                <DraftTypeCard active={mode === "existing"} onClick={selectExistingDraft} title="Continue Existing Draft" description="Set the board to match how your real draft has unfolded, then take over from the exact spot you are in." />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4 border-t border-border pt-6 sm:mt-7 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-ink-secondary">
            {["Linear rookie draft", `${teams} teams`, qbFormat === "SUPERFLEX" ? "Superflex" : "1 QB", ...(teFormat === "TEP" ? ["TEP"] : []), formatPickTimerLabel(pickTimer)].join(" · ")}
          </div>
          <button
            type="button"
            onClick={startSelectedDraft}
            disabled={!mode}
            className={cn(
              "inline-flex min-h-12 w-full items-center justify-center gap-2 px-5 py-3 text-sm font-semibold transition-colors sm:w-auto",
              mode ? "bg-accent text-white shadow-[0_12px_28px_-16px_rgba(37,99,235,.9)] hover:bg-accent-dim" : "cursor-not-allowed bg-surface text-ink-tertiary"
            )}
          >
            {!mode ? "Select Draft Type" : mode === "existing" ? "Start Existing Draft" : "Start Draft"}<ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </section>
    );
  }

  if (step === "results" && !viewingBoardAfterComplete) {
    return (
      <ResultsScreen
        classYear={classYear}
        settings={settings}
        picks={picks}
        prospectById={prospectById}
        gradeRows={gradeRows}
        overallGrade={overallGrade}
        ddValueCaptured={ddValueCaptured}
        onReset={resetDraft}
        onViewBoard={() => setViewingBoardAfterComplete(true)}
      />
    );
  }

  // The draft board now matches the site's light theme throughout —
  // reversed from an earlier dark "draft room" treatment, which was
  // a deliberate choice at the time but ended up looking out of
  // place against the rest of the (otherwise entirely light) site.
  // The bespoke dark-navy board colors that used to live here were
  // replaced with the same theme tokens the rest of the site uses.
  return (
    <section className="mock-draft-shell fixed inset-x-0 bottom-0 top-16 z-40 flex min-h-0 flex-col overflow-hidden bg-void sm:static sm:z-auto sm:block sm:min-h-0 sm:overflow-visible">
      {mode === "existing" && existingPickIndex < maxPicks && existingPickIndex < manualEntryLimit && (
        <div className="mb-4 border border-accent/30 bg-accent/5 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-widest2 text-accent">Continue Existing Draft</p>
              <h3 className="mt-1 text-lg font-semibold text-ink">Enter the picks that already happened</h3>
              <p className="mt-1 text-xs leading-relaxed text-ink-secondary">Enter picks in order until the board reaches your slot. The board below stays in Dynasty Database order.</p>
            </div>
            <button onClick={() => setMode("new")} className="hidden border border-border-strong px-3 py-2 text-xs text-ink-secondary hover:text-ink sm:block">Switch to new draft</button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_280px]">
            <div className="border border-border bg-surface p-3">
              <div className="flex items-center justify-between font-data text-[10px] text-ink-tertiary"><span className="font-tech uppercase tracking-widest2">Pick</span><span>{formatPick(existingPickIndex + 1, teams)}</span><span>{existingPickIndex + 1} of {manualEntryLimit}</span></div>
              <div className="mt-3 flex items-center gap-2 border border-border-strong bg-surface-raised px-3 py-2.5"><Search className="h-4 w-4 text-ink-tertiary" /><input value={existingPlayerSearch} onChange={(e) => setExistingPlayerSearch(e.target.value)} placeholder="Find player" className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-tertiary" /></div>
              <div className="mt-2 max-h-56 overflow-y-auto divide-y divide-border overscroll-contain pb-3">
                {existingCandidates.map((p) => <button key={p.id} onClick={() => enterExistingPick(p)} className="flex w-full items-center justify-between px-2 py-2.5 text-left hover:bg-surface-raised"><span><span className="font-medium text-ink">{p.name}</span><span className="ml-2 text-xs text-ink-tertiary">{p.position}</span></span><span className="font-data text-xs text-ink-secondary">#{playerRankLabel(p, settings, ddRankMap)}</span></button>)}
              </div>
            </div>
            <div className="border border-border bg-surface p-3">
              <p className="font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary">Already entered</p>
              <div className="mt-2 space-y-1.5">{picks.slice(-6).map((pick) => { const p = prospectById.get(pick.playerId); return <div key={pick.overall} className="flex items-center justify-between text-xs"><span className="font-data text-ink-tertiary">{formatPick(pick.overall, teams)}</span><span className="truncate px-2 text-ink-secondary">{p?.name}</span><span className="text-ink-tertiary">{p?.position}</span></div>; })}</div>
            </div>
          </div>
        </div>
      )}

      <div className="mock-draft-toolbar shrink-0 flex flex-col gap-1.5 border-b border-border bg-surface px-3 py-2 sm:mb-4 sm:flex-row sm:items-center sm:justify-between sm:border sm:border-border-strong sm:px-5 sm:py-4">
        <div className="flex items-center gap-3">
          <button onClick={resetDraft} aria-label="Back to draft setup" className="flex h-9 w-9 items-center justify-center border border-border-strong text-ink-secondary hover:border-accent hover:text-accent"><ArrowLeft className="h-4 w-4" /></button>
          {viewingBoardAfterComplete && (
            <button
              type="button"
              onClick={() => setViewingBoardAfterComplete(false)}
              className="back-to-results flex shrink-0 items-center gap-2 whitespace-nowrap border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent"
            >
              <Trophy className="h-3.5 w-3.5" /> Back to results
            </button>
          )}
          <button
            type="button"
            onClick={() => setPaused((v) => !v)}
            aria-pressed={paused}
            title={paused ? "Resume draft" : "Pause draft"}
            className={cn(
              "flex h-9 w-9 items-center justify-center border transition-colors",
              paused ? "border-accent bg-accent/10 text-accent" : "border-border-strong text-ink-secondary hover:border-accent hover:text-accent"
            )}
          >
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
          <div><div className="flex items-center gap-2"><h2 className="font-headline text-base uppercase tracking-tight text-ink">{classYear} Mock Draft</h2><span className="border border-accent/30 bg-accent/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest2 text-accent"><span className="sm:hidden">{engineLabelShort(engine)}</span><span className="hidden sm:inline">{engineLabel(engine)}</span></span>{paused && <span className="border border-accent/30 bg-accent/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest2 text-accent">Paused</span>}</div><p className="mt-0.5 text-[11px] text-ink-tertiary">{[`${teams} teams`, qbFormat === "SUPERFLEX" ? "Superflex" : "1 QB", ...(teFormat === "TEP" ? ["TEP"] : []), formatPickTimerLabel(pickTimer), "Linear"].join(" · ")}</p></div>
        </div>
        <div
          className={cn(
            "flex items-center gap-2 border px-3 py-1.5",
            pickTimer === "UNTIMED"
              ? "border-border-strong"
              : isUserTurn && remainingSeconds !== null && remainingSeconds <= 10
              ? "border-faller/50 bg-faller/10"
              : "border-accent/40 bg-accent/10"
          )}
        >
          <span className={cn("h-2 w-2 shrink-0 rounded-full", pickTimer === "UNTIMED" ? "bg-riser" : "bg-accent")} />
          {pickTimer !== "UNTIMED" && isUserTurn && remainingSeconds !== null ? (
            <>
              <span className={cn("font-data text-2xl font-bold", remainingSeconds <= 10 ? "text-faller" : "text-ink")}>
                {formatCountdown(remainingSeconds)}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary">per pick</span>
            </>
          ) : (
            <span className="text-sm text-ink-secondary">
              {pickTimer === "UNTIMED" ? "Untimed" : formatPickTimerLabel(pickTimer)}
            </span>
          )}
        </div>
      </div>

      <div className="mock-draft-layout flex min-h-0 min-w-0 flex-1 flex-col gap-0 lg:grid lg:grid-cols-[minmax(0,1.45fr)_minmax(380px,.9fr)] lg:gap-4">
        <div className="mock-draft-board-panel relative flex h-[48%] min-h-0 min-w-0 shrink-0 flex-col overflow-hidden border-b border-border bg-surface-raised lg:h-auto lg:min-h-0 lg:border lg:border-border-strong">
          {/* Watermark attempt removed — reported directly as looking
              bad at the size needed to actually be visible. Replaced
              with something much quieter: the panel's own background
              is now the same soft surface-raised tone already used
              for the round-banding inside the grid (bg-void here
              would read as literal blank white; this is a color
              choice already established elsewhere on this exact
              board, not a new one). The grid's individual cells still
              carry their own bg-surface/round-tint backgrounds on top
              of this, so nothing about the grid itself changes — this
              only affects the genuinely empty area below it. */}
          <div className="flex shrink-0 items-center justify-between border-b border-border bg-surface px-3 py-2 sm:px-4 sm:py-2.5">
            <div className="flex items-center gap-2">
              {/* "Draft board" label removed — the grid of team
                  columns is self-evidently a board; a text label
                  above it added a full row of height to say something
                  the layout already communicates on its own. Round/
                  Pick promoted straight to the top of this header. */}
              <p className="mock-draft-pick-label font-headline text-sm uppercase leading-none tracking-tight text-ink sm:text-xl lg:text-2xl">
                {draftComplete ? "Draft Complete" : <>Round {currentRound} · Pick {formatPick(currentOverall, teams)}</>}
              </p>
              {isUserTurn && (
                <span className="inline-flex shrink-0 items-center gap-1 border border-accent/40 bg-accent/10 px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-widest2 text-accent">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Your Pick
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest2 text-ink-tertiary">
              <ChevronLeft className="h-4 w-4" /> swipe <ChevronRight className="h-4 w-4" />
            </div>
          </div>

          <div ref={draftBoardScrollRef} className="mock-board-scroll min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-smooth lg:h-auto lg:max-h-[calc(100vh-17rem)] lg:overflow-auto">
            {/* Reverted the grid-line extension entirely, not just
                toned it down — reported directly, correctly: even
                without fake pick data, continuing the grid's own
                divider lines past the real rounds still visually
                claims "more grid exists here," which is genuinely
                misleading for a draft that only has 4 rounds. This
                area now uses nothing that borrows the grid's own
                visual language at all — just a plain, solid, honestly
                empty tone (the panel's own bg-surface-raised showing
                through, set two rounds ago). The border-b lives on
                the grid itself, not this wrapper, so it lands exactly
                at the bottom of the last real round — marking where
                real content ends, not implying anything continues
                past it. */}
            <div
              className="mock-draft-grid-wrap min-h-full p-2 sm:p-3"
              style={{ minWidth: `calc(${teams} * var(--mock-col-width))` }}
            >
              <div className="mock-draft-grid grid border-b border-border" style={{ gridTemplateColumns: `repeat(${teams}, var(--mock-col-width))` }}>
                {/* snap-start here, not on some wrapping "column" div —
                    this is a CSS grid, so a team's own picks are
                    separate cells sharing a grid-column position, not
                    nested inside one discrete column element. The
                    header cell is the one real per-team DOM node,
                    positioned by the grid at the correct horizontal
                    spot, so it's what the browser's native scroll-snap
                    aligns to. Genuine native scroll-snap, not a custom
                    touch handler — swiping between teams now settles
                    cleanly on a column edge instead of stopping at
                    whatever arbitrary position momentum happened to
                    leave it at. */}
                {Array.from({ length: teams }, (_, i) => i + 1).map((team) => (
                  <div key={team} className={cn("snap-start border-b border-r border-border bg-surface-raised px-1.5 py-1.5", team === slot && "mock-user-draft-column bg-accent/5")}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-data text-[9px] font-semibold", team === slot ? "border-accent bg-accent/10 text-accent" : "border-border-strong bg-surface-raised text-ink-tertiary")}>{team}</span>
                        <span className="truncate font-mono text-[9px] font-semibold uppercase tracking-widest2 text-ink-secondary">Team {team}</span>
                      </span>
                      {team === slot && <span className="font-mono text-[8px] uppercase tracking-widest2 text-accent">You</span>}
                    </div>
                  </div>
                ))}

                {Array.from({ length: Math.ceil(maxPicks / teams) }).map((_, roundIndex) => (
                  Array.from({ length: teams }, (_, slotIndex) => {
                    const team = slotIndex + 1;
                    const overall = roundIndex * teams + team;
                    const pick = picks.find((p) => p.overall === overall);
                    const player = pick ? prospectById.get(pick.playerId) : undefined;
                    const pickTier = player ? getTierForFormat(player, qbFormat, teFormat) : undefined;
                    const isCurrent = overall === currentOverall;
                    return (
                      <button
                        key={overall}
                        type="button"
                        onClick={() => pick && setExpandedPick(expandedPick === overall ? null : overall)}
                        className={cn(
                          "relative min-h-[46px] border-b border-r border-l-[3px] border-border p-1.5 text-left transition-colors",
                          // A single prioritized background choice, not
                          // several bg-* utilities layered together —
                          // Tailwind utilities of equal specificity
                          // don't reliably "win" based on className
                          // order, only on their generated CSS source
                          // order, which isn't something to depend on.
                          // Computing one class up front avoids that
                          // risk entirely. The alternating round tint
                          // is intentionally faint (2% opacity) — the
                          // ask was "not drastic," and this is meant
                          // to add quiet rhythm to a grid that reads
                          // as flat with every cell on identical white,
                          // not to introduce a loud striping pattern.
                          isCurrent ? "bg-accent/10 ring-1 ring-inset ring-accent" : team === slot ? "mock-user-draft-column bg-accent/5" : roundIndex % 2 === 1 ? "bg-void/[0.025]" : "bg-surface",
                          pick && "hover:bg-surface-raised"
                        )}
                        style={pickTier ? { borderLeftColor: getTierColor(pickTier) } : undefined}
                      >
                        <span className="absolute right-2 top-2 font-data text-[9px] text-ink-tertiary">{formatPick(overall, teams)}</span>
                        {player ? (
                          // Was a normal-flow text block with the photo
                          // absolutely pinned to the bottom-right corner
                          // over it — for a name that wraps to 2-3 lines
                          // (line-clamp-3 allows exactly that), the text
                          // could extend down far enough to collide with
                          // the photo, since absolute positioning means
                          // neither element accounts for the other's
                          // actual size. Reported directly, with a
                          // screenshot showing "Jeremiah Smith" and "Cam
                          // Coleman" overlapping their own photos. A real
                          // flex row instead: the photo gets a fixed,
                          // reserved width via shrink-0, and the text
                          // column is constrained to whatever's left
                          // (min-w-0 flex-1) — text wraps or truncates
                          // within its own space, never behind the photo,
                          // regardless of how long the name is.
                          <div className="relative flex animate-fade-in items-start gap-1 pt-7 lg:block lg:pt-8">
                            <div className="min-w-0 flex-1 lg:pr-16">
                              <span className={cn("absolute left-1.5 top-1.5 inline-flex border px-1.5 py-0.5 font-mono text-[8px] font-semibold", POSITION_CLASS[player.position])}>{player.position}</span>
                              <p className="line-clamp-2 break-words text-[11px] font-semibold leading-[1.15] text-ink">{player.name}</p>
                              <p className="mt-1 font-data text-[10px] font-semibold" style={{ color: pickTier ? getTierColor(pickTier) : undefined }}>DD {getScoreForFormat(player, qbFormat, teFormat)?.toFixed(1) ?? "TBD"}</p>
                            </div>
                            {player.photoUrl && (
                              <Image
                                src={player.photoUrl}
                                alt=""
                                width={24}
                                height={24}
                                unoptimized
                                className="h-6 w-6 shrink-0 rounded-full object-cover opacity-90 lg:absolute lg:bottom-2 lg:right-2 lg:h-12 lg:w-12"
                              />
                            )}
                          </div>
                        ) : isCurrent ? (
                          <div className="flex h-full min-h-[40px] items-center justify-center">
                            <div className="text-center">
                              <Sparkles className="mx-auto h-4 w-4 text-accent" />
                              <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest2 text-accent">{isUserTurn ? "Your pick" : "On the clock"}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex h-full min-h-[40px] items-end justify-end"><span className="font-mono text-[10px] text-ink-tertiary">—</span></div>
                        )}
                      </button>
                    );
                  })
                ))}
              </div>
            </div>
          </div>

          <div className="hidden border-t border-border bg-surface-raised px-4 py-3 lg:block">
            {paused ? (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-ink-secondary"><Pause className="h-3.5 w-3.5 text-accent" /> Draft paused</div>
                <button type="button" onClick={() => setPaused(false)} className="border border-accent/40 bg-accent/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest2 text-accent hover:bg-accent/20">Resume</button>
              </div>
            ) : draftComplete ? (
              <div className="flex items-center gap-2 text-xs text-ink-secondary"><Trophy className="h-3.5 w-3.5 text-accent" /> Draft complete</div>
            ) : computerThinking ? (
              <div className="flex items-center gap-2 text-xs text-ink-secondary"><span className="h-2 w-2 animate-pulse rounded-full bg-accent" /> {engineLabel(engine)} is making a pick…</div>
            ) : isUserTurn ? (
              <div className="flex items-center justify-between gap-3">
                <div><p className="font-mono text-[9px] uppercase tracking-widest2 text-accent">On the clock</p><p className="mt-1 text-sm font-semibold text-ink">Your pick: {formatPick(currentOverall, teams)}</p></div>
                {pickTimer === "UNTIMED" || remainingSeconds === null ? (
                  <span className="font-mono text-[9px] uppercase tracking-widest2 text-ink-tertiary">No timer</span>
                ) : (
                  <span className={cn("font-data text-2xl font-bold", remainingSeconds <= 10 ? "text-faller" : "text-ink")}>
                    {formatCountdown(remainingSeconds)}
                  </span>
                )}
              </div>
            ) : (
              <div className="text-xs text-ink-secondary">Waiting for the computer to select {formatPick(currentOverall, teams)}.</div>
            )}
          </div>
        </div>

        <div className={cn("mock-player-panel relative z-20 flex min-h-0 min-w-0 flex-col border-t border-border bg-surface lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-hidden lg:border", mobilePlayersExpanded ? "mobile-expanded" : "h-[52%]", "lg:static lg:h-auto lg:shadow-none")}>
          <div
            className="mock-player-sheet-handle mock-player-header shrink-0 border-b border-border px-3 py-2 sm:px-4 sm:py-2.5"
            onTouchStart={(e) => { mobileSheetTouchStart.current = e.touches[0]?.clientY ?? null; }}
            onTouchEnd={(e) => {
              const start = mobileSheetTouchStart.current;
              const end = e.changedTouches[0]?.clientY;
              mobileSheetTouchStart.current = null;
              if (start == null || end == null) return;
              const delta = end - start;
              if (Math.abs(delta) < 35) return;
              setMobilePlayersExpanded(delta < 0);
            }}
          >
            <button type="button" aria-label={mobilePlayersExpanded ? "Collapse players" : "Expand players"} onClick={() => setMobilePlayersExpanded((v) => !v)} className="mx-auto mb-1.5 block h-1.5 w-10 rounded-full bg-border-strong lg:hidden" />
            <nav aria-label="Mock draft player views" className="grid grid-cols-3 items-stretch">
              <button type="button" onClick={() => { closePlayerSearch(); setMobilePlayerTab("available"); setMobilePlayersExpanded(false); }} className={cn("min-h-9 border-r border-border px-2 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest2", mobilePlayerTab === "available" ? "text-accent" : "text-ink-tertiary")}>Players</button>
              <button type="button" onClick={() => { closePlayerSearch(); setMobilePlayerTab("queue"); setMobilePlayersExpanded(false); }} className={cn("min-h-9 border-r border-border px-2 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest2", mobilePlayerTab === "queue" ? "text-accent" : "text-ink-tertiary")}>
                <span className="inline-flex items-center gap-1">Queue{queue.length > 0 && <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[8px] text-accent">{queue.length}</span>}</span>
              </button>
              <button type="button" onClick={() => { closePlayerSearch(); setMobilePlayerTab("team"); setMobilePlayersExpanded(false); }} className={cn("min-h-9 px-2 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest2", mobilePlayerTab === "team" ? "text-accent" : "text-ink-tertiary")}>My Team</button>
            </nav>
          </div>

          {/* Best Available/Best Fit callout removed entirely — was
              here, but reported directly as consuming too much
              vertical space before the actual player list even
              starts. The same information (rank #1, tier, DD Score)
              is still the very first row of the list itself, just
              without a second, separate section repeating it above
              the list. */}

          <div className={cn("mock-player-controls border-b border-border px-3 py-2", mobilePlayerTab !== "available" && "hidden lg:block")}>
            {searchOpen ? (
              <div className="flex min-h-10 items-center gap-2 border border-border-strong bg-surface-raised px-3 py-1.5">
                <Search className="h-4 w-4 shrink-0 text-ink-tertiary" />
                <input
                  ref={searchInputRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Escape") closePlayerSearch(); }}
                  placeholder="Search players"
                  inputMode="search"
                  enterKeyHint="search"
                  autoComplete="off"
                  className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-tertiary"
                />
                {search && (
                  <button type="button" onClick={closePlayerSearch} aria-label="Clear search and return to players" className="flex h-8 w-8 shrink-0 items-center justify-center text-ink-tertiary hover:text-ink">
                    <X className="h-4 w-4" />
                  </button>
                )}
                <button type="button" onClick={closePlayerSearch} className="shrink-0 px-1 py-1 font-mono text-[9px] font-semibold uppercase tracking-widest2 text-accent">Cancel</button>
              </div>
            ) : (
              <div className="flex items-center gap-2 overflow-x-auto">
                <button type="button" onClick={() => setSearchOpen(true)} aria-label="Search players" className="flex h-10 w-10 shrink-0 items-center justify-center border border-border-strong bg-surface text-ink-tertiary hover:text-ink">
                  <Search className="h-4 w-4" />
                </button>
                {activeSyncedNeeds && (
                  <button type="button" onClick={() => setPositionFilter("SUGGESTED")} className={cn("shrink-0 border px-3 py-2 font-mono text-[9px] uppercase tracking-widest2 transition-colors", positionFilter === "SUGGESTED" ? "border-accent bg-accent text-white" : "border-accent/50 bg-accent/10 text-accent hover:bg-accent/20")}>
                    {activeSyncedNeeds.bpaMode ? "Best Available" : "Suggested"}
                  </button>
                )}
                {(["ALL", "QB", "RB", "WR", "TE"] as const).map((pos) => (
                  <button key={pos} type="button" onClick={() => setPositionFilter(pos)} className={cn("flex h-10 shrink-0 items-center justify-center border px-4 font-mono text-[9px] uppercase tracking-widest2 transition-colors", positionFilter === pos ? "border-accent bg-accent text-white" : "border-border-strong bg-surface text-ink-secondary hover:text-ink")}>{pos === "ALL" ? "All" : pos}</button>
                ))}
                <Filter className="ml-auto h-4 w-4 shrink-0 text-ink-tertiary" />
              </div>
            )}
          </div>

          <div className="mock-player-list min-h-0 flex-1 overflow-y-auto overscroll-y-contain pb-6 [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch] lg:h-[calc(100vh-15rem)] lg:max-h-[calc(100vh-15rem)]">
            {mobilePlayerTab === "team" ? (
              <>
                {/* Answers "what is my team missing" directly in the
                    one place that question naturally comes up —
                    genuinely absent before this (My Team only ever
                    listed picks, no needs summary anywhere). Only
                    renders with real synced-needs data behind it, the
                    same real signal Best Fit and the Need badges
                    already use — this mock draft has no roster-
                    construction data to fall back on for a
                    non-synced draft, so there's nothing honest to
                    say there, and it correctly says nothing. */}
                {activeSyncedNeeds && !activeSyncedNeeds.bpaMode && (() => {
                  const stillNeeded = activeSyncedNeeds.needs.filter(
                    (n) => n.needScore > 0 && isPositionStillSuggested(n.position, activeSyncedNeeds, userPositionCounts)
                  );
                  if (!stillNeeded.length) return null;
                  return (
                    <div className="border-b border-accent/30 bg-accent/5 px-3 py-2 sm:px-4">
                      <span className="font-mono text-[9px] font-semibold uppercase tracking-widest2 text-accent">Still needed: </span>
                      <span className="text-xs text-ink">{stillNeeded.map((n) => n.position).join(", ")}</span>
                    </div>
                  );
                })()}
              {/* Genuinely grouped by real drafted position, not a fake
                  starting-lineup slot grid (QB/RB1/RB2/WR1.../FLEX) —
                  this mock draft has no configured roster-construction
                  data anywhere (checked directly: no starting-slot
                  counts exist in MockSettings), so a slot grid would be
                  inventing structure the system was never told about.
                  Real picks, grouped by their real position, is the
                  honest version of the same idea. */}
              {userPicks.length ? (
                POSITION_ORDER.filter((pos) => userPicks.some((p) => p.position === pos)).map((pos) => {
                  const group = userPicks.filter((p) => p.position === pos);
                  return (
                    <div key={pos}>
                      <div className="flex items-center justify-between border-b border-border bg-surface-raised px-3 py-1.5 sm:px-4">
                        <span className="font-mono text-[9px] font-semibold uppercase tracking-widest2 text-ink-tertiary">{pos}</span>
                        <span className="font-data text-[9px] text-ink-tertiary">{group.length}</span>
                      </div>
                      {group.map((p) => (
                        <div key={p.id} className="flex items-center gap-3 border-b border-border px-3 py-2 sm:px-4">
                          <span className="w-7 shrink-0 text-right font-data text-[10px] text-ink-tertiary">{formatPick(picks.find((x) => x.playerId === p.id)?.overall ?? 0, teams)}</span>
                          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-ink">{p.name}</p><p className="mt-1 text-[10px] text-ink-tertiary">{p.school ?? ""} · DD {getScoreForFormat(p, qbFormat, teFormat)?.toFixed(1) ?? "TBD"}</p></div>
                        </div>
                      ))}
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-sm text-ink-tertiary">No players drafted yet.</div>
              )}
              </>
            ) : mobilePlayerTab === "queue" ? (
              queue.length ? (
                queue.map((id) => {
                  const qp = prospectById.get(id);
                  if (!qp) return null;
                  const qScore = getScoreForFormat(qp, qbFormat, teFormat);
                  const qTier = getTierForFormat(qp, qbFormat, teFormat);
                  return (
                    <div key={id} className="flex items-center gap-3 border-b border-border px-3 py-2 sm:px-4">
                      <span className={cn("h-2 w-2 shrink-0 rounded-full", POSITION_DOT[qp.position])} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{qp.name}</p>
                        <p className="mt-1 text-[10px] text-ink-tertiary">{qp.position} · {qTier ?? "TBD"} · DD {qScore?.toFixed(1) ?? "TBD"}</p>
                      </div>
                      {isUserTurn && !computerThinking && (
                        <button type="button" onClick={() => makePick(qp, true)} className="shrink-0 bg-accent px-3 py-2 text-xs font-semibold text-white hover:bg-accent-dim">Pick</button>
                      )}
                      <button type="button" onClick={() => toggleQueued(id)} aria-label={`Remove ${qp.name} from queue`} className="shrink-0 text-ink-tertiary hover:text-faller"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-sm text-ink-tertiary">No players queued yet. Add targets from the available list.</div>
              )
            ) : (
              <div className="mock-player-rows-scroll overflow-x-auto">
                <div className="mock-player-scroll-content w-max min-w-full">
              {filteredAvailable.map((p, idx) => {
              const rank = playerRankLabel(p, settings, ddRankMap);
              const score = getScoreForFormat(p, qbFormat, teFormat);
              const tier = getTierForFormat(p, qbFormat, teFormat);
              // filteredAvailable is already rank-sorted (see its own
              // comment above), so comparing each player's tier
              // against the one immediately before it in this same
              // list is a real, correct way to detect where a tier
              // genuinely ends — not a guess or a separate
              // recomputation, just reading the order that's already
              // there. Only renders when both tiers are real (not
              // TBD) and actually differ, so a run of same-tier
              // players never gets a break drawn between them.
              const prevPlayer = idx > 0 ? filteredAvailable[idx - 1] : null;
              const prevTier = prevPlayer ? getTierForFormat(prevPlayer, qbFormat, teFormat) : null;
              const showTierBreak = idx > 0 && !!tier && !!prevTier && tier !== prevTier;
              const communityPlayer =
                community.get(normalizePlayerName(p.name)) ??
                community.get(p.name.trim().toLowerCase()) ??
                community.get(p.name.trim().toLowerCase().replace(/\b(jr|sr|ii|iii|iv|v)\.?$/i, "").trim());
              const cr = communityPlayer?.rank;
              const diff = typeof rank === "number" && cr ? cr - rank : null;
              const canPick = isUserTurn && !computerThinking;
              const isSuggested =
                positionFilter !== "SUGGESTED" &&
                !!activeSyncedNeeds &&
                !activeSyncedNeeds.bpaMode &&
                isPositionStillSuggested(p.position, activeSyncedNeeds, userPositionCounts);
              return (
                <Fragment key={p.id}>
                  {showTierBreak && (
                    <div
                      className="mock-player-tier-break border-y-2 border-border-strong bg-surface px-3 py-1 sm:px-4"
                      style={{ borderTopColor: tier ? getTierColor(tier) : undefined, borderBottomColor: tier ? getTierColor(tier) : undefined }}
                    >
                      <span className="font-mono text-[9px] font-semibold uppercase tracking-widest2" style={{ color: tier ? getTierColor(tier) : undefined }}>
                        {tier}
                      </span>
                    </div>
                  )}
                  <AvailablePlayerRow
                    p={p}
                    rank={rank}
                    score={score}
                    tier={tier}
                    cr={cr}
                    diff={diff}
                    canPick={canPick}
                    isSuggested={isSuggested}
                    positionTierHitRates={positionTierHitRates}
                    queue={queue}
                    toggleQueued={toggleQueued}
                    setExpandedPlayerId={setExpandedPlayerId}
                    closePlayerSearch={closePlayerSearch}
                    makePick={makePick}
                  />
                </Fragment>
              );
            })}
                </div>
              </div>
            )}
            {mobilePlayerTab === "available" && !filteredAvailable.length && <div className="p-8 text-center text-sm text-ink-tertiary">No players match your search.</div>}
          </div>

          <div className="hidden border-t border-border bg-surface-raised px-4 py-3 lg:block">
            {engine === "COMMUNITY" && (communitySource === "loading" || communitySource === "unavailable") ? (
              <div className="mb-2 font-mono text-[9px] uppercase tracking-widest2 text-ink-tertiary">Community board: {getCommunityFormatLabel(qbFormat, teFormat)} · Source: FantasyCalc</div>
            ) : null}
            {engine === "COMMUNITY" && communitySource === "loading" ? (
              <div className="flex items-center gap-2 text-xs text-ink-secondary"><span className="h-2 w-2 animate-pulse rounded-full bg-accent" /> Loading Community Rankings before the computer starts drafting…</div>
            ) : engine === "COMMUNITY" && communitySource === "unavailable" ? (
              <div className="flex items-center justify-between gap-3 text-xs text-ink-secondary"><span>FantasyCalc Community Rankings are currently unavailable, so computer picks are paused.</span><button type="button" onClick={() => window.location.reload()} className="shrink-0 border border-border-strong px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-widest2 text-ink hover:border-accent hover:text-accent">Retry</button></div>
            ) : paused ? <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-xs text-ink-secondary"><Pause className="h-3.5 w-3.5 text-accent" /> Draft paused</div><button type="button" onClick={() => setPaused(false)} className="border border-accent/40 bg-accent/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest2 text-accent hover:bg-accent/20">Resume</button></div> : draftComplete ? <div className="flex items-center gap-2 text-xs text-ink-secondary"><Trophy className="h-3.5 w-3.5 text-accent" /> Draft complete</div> : computerThinking ? <div className="flex items-center gap-2 text-xs text-ink-secondary"><span className="h-2 w-2 animate-pulse rounded-full bg-accent" /> {engineLabel(engine)} is making a pick…</div> : isUserTurn ? <div className="flex items-center justify-between gap-3"><div><p className="font-mono text-[9px] uppercase tracking-widest2 text-accent">On the clock</p><p className="mt-1 text-sm font-semibold text-ink">Your pick: {formatPick(currentOverall, teams)}</p></div>{pickTimer === "UNTIMED" || remainingSeconds === null ? <span className="font-mono text-[9px] uppercase tracking-widest2 text-ink-tertiary">No timer</span> : <span className={cn("font-data text-2xl font-bold", remainingSeconds <= 10 ? "text-faller" : "text-ink")}>{formatCountdown(remainingSeconds)}</span>}</div> : <div className="text-xs text-ink-secondary">Waiting for the computer to select {formatPick(currentOverall, teams)}.</div>}
          </div>
        </div>
      </div>

      {(expandedPick || expandedPlayerId) && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto px-4 pb-8 pt-20 sm:items-center sm:py-12">
          {/* pt-20, not a symmetric py-8 — the site navbar is a fixed
              64px (h-16) sticky element sitting above this modal's own
              z-index. A symmetric 32px top offset put this modal's
              close button (absolute top-4 within it) at roughly 48px
              from the true top of the viewport — inside the navbar's
              own 64px zone, making it genuinely hard to tap precisely
              without also hitting navbar controls. 80px clears the
              navbar with real room to spare. Desktop's sm:items-center
              already avoids this since centering doesn't pin content
              near the top at all, so only the mobile value needed to
              change. */}
          {/* Same real modal pattern already used for global Search
              (fixed inset-0 backdrop + a separately centered content
              wrapper), not the small bottom-right anchored box this
              was before. Now also the same modal an available-list row
              opens, not a second, different inline-expand behavior —
              reported directly: tapping a player in the available list
              expanded inline within the scrollable panel, which meant
              the rich card content was never fully visible without
              scrolling an already-scrolled, height-constrained sheet.
              One interaction, one real popup, everywhere a player can
              be opened from. */}
          <div className="fixed inset-0 animate-fade-in bg-void/80 backdrop-blur-sm" onClick={() => { setExpandedPick(null); setExpandedPlayerId(null); }} />
          <div className="relative z-10 w-full max-w-2xl shrink-0 self-start animate-fade-in-up border border-border-strong bg-surface p-5 shadow-2xl [animation-duration:200ms] sm:self-center sm:p-7">
            <button onClick={() => { setExpandedPick(null); setExpandedPlayerId(null); }} aria-label="Close player details" className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center border border-border bg-surface text-ink-tertiary hover:text-ink">
              <ChevronDown className="h-4 w-4" />
            </button>
            {(() => {
              const pick = expandedPick ? picks.find((x) => x.overall === expandedPick) : undefined;
              const prospect = pick ? prospectById.get(pick.playerId) : expandedPlayerId ? prospectById.get(expandedPlayerId) : undefined;
              if (!prospect) return null;
              const pickTier = getTierForFormat(prospect, qbFormat, teFormat);
              const pickCommunityPlayer =
                community.get(normalizePlayerName(prospect.name)) ??
                community.get(prospect.name.trim().toLowerCase()) ??
                community.get(prospect.name.trim().toLowerCase().replace(/\b(jr|sr|ii|iii|iv|v)\.?$/i, "").trim());
              const pickCr = pickCommunityPlayer?.rank;
              const pickRank = playerRankLabel(prospect, settings, ddRankMap);
              const pickDiff = typeof pickRank === "number" && pickCr ? pickCr - pickRank : null;
              return (
                <div>
                  {/* Pick/team context only makes sense for an actual
                      completed pick — an available player hasn't been
                      drafted by anyone yet, so there's no "1.08 · Team
                      8" to show for them. */}
                  {pick && (
                    <p className="pr-8 font-tech text-[9px] uppercase tracking-widest2 text-ink-tertiary"><span className="font-data">{formatPick(pick.overall, teams)}</span> · Team <span className="font-data">{pick.slot}</span></p>
                  )}
                  <div className={cn(pick && "mt-3")}>
                    <MockDraftPlayerCard
                      prospect={prospect}
                      rank={pickRank}
                      score={getScoreForFormat(prospect, qbFormat, teFormat)}
                      tier={pickTier}
                      tierHitRate={pickTier ? positionTierHitRates.get(`${prospect.position}:${pickTier}`) : undefined}
                      communityRank={pickCr}
                      communityDiff={pickDiff}
                      qbFormat={qbFormat}
                      teFormat={teFormat}
                    />
                  </div>
                  {/* An available (not yet drafted) player can still be
                      picked or queued right from the modal — closing
                      it first just to reach the same Pick button on
                      the row behind it would be exactly the kind of
                      unnecessary navigation this whole pass is trying
                      to remove. */}
                  {!pick && (
                    <div className="mt-4 flex gap-2 border-t border-border pt-4">
                      <button
                        type="button"
                        onClick={() => toggleQueued(prospect.id)}
                        className={cn("flex flex-1 items-center justify-center gap-1.5 border px-3 py-2.5 text-xs font-semibold", queue.includes(prospect.id) ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-ink-secondary hover:text-ink")}
                      >
                        <Bookmark className="h-5 w-5" fill={queue.includes(prospect.id) ? "currentColor" : "none"} />
                        {queue.includes(prospect.id) ? "Queued" : "Add to Queue"}
                      </button>
                      {isUserTurn && !computerThinking && (
                        <button
                          type="button"
                          onClick={() => { makePick(prospect, true); setExpandedPlayerId(null); }}
                          className="flex-1 bg-accent px-3 py-2.5 text-xs font-semibold text-white hover:bg-accent-dim"
                        >
                          Pick
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </section>
  );
}

function Segment<T extends string | number>({ label, options, value, onChange, display }: { label: string; options: readonly T[]; value: T; onChange: (v: T) => void; display?: (v: T) => string }) {
  return <div><label className="mb-2 block font-mono text-[10px] font-semibold uppercase tracking-widest2 text-ink-tertiary">{label}</label><div className="grid grid-cols-3 gap-1.5">{options.map((option) => <button key={String(option)} onClick={() => onChange(option)} className={cn("min-h-10 border px-2 py-2.5 text-xs font-semibold transition-all", value === option ? "border-accent bg-accent text-white shadow-[0_8px_18px_-14px_rgba(37,99,235,.9)]" : "border-border-strong bg-surface-raised text-ink-secondary hover:border-accent/50 hover:text-ink")}>{display ? display(option) : option}</button>)}</div></div>;
}

function EngineCard({ active, onClick, title, short, description }: { active: boolean; onClick: () => void; title: string; short: string; description: string }) {
  return <button onClick={onClick} className={cn("group flex items-center gap-3 border p-3.5 text-left transition-all", active ? "border-accent bg-accent/5 shadow-[0_12px_28px_-24px_rgba(37,99,235,.8)]" : "border-border-strong bg-surface-raised hover:border-accent/50 hover:bg-surface")}><span className={cn("flex h-11 w-11 shrink-0 items-center justify-center border font-mono text-xs font-bold transition-colors", active ? "border-accent bg-accent text-white" : "border-border text-accent group-hover:border-accent/40")}>{short}</span><span className="min-w-0"><span className="block text-sm font-semibold text-ink">{title}</span><span className="mt-1 block text-xs leading-relaxed text-ink-tertiary">{description}</span></span>{active && <span className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-white"><Check className="h-3.5 w-3.5" /></span>}</button>;
}

function DraftTypeCard({ active, onClick, title, description }: { active: boolean; onClick: () => void; title: string; description: string }) {
  return <button onClick={onClick} className={cn("group border p-4 text-left transition-all", active ? "border-accent bg-accent/5 shadow-[0_12px_28px_-24px_rgba(37,99,235,.8)]" : "border-border-strong bg-surface-raised hover:border-accent/50 hover:bg-surface")}><div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold text-ink">{title}</span>{active && <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-white"><Check className="h-3.5 w-3.5" /></span>}</div><p className="mt-1.5 text-xs leading-relaxed text-ink-tertiary">{description}</p></button>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="border border-border bg-surface-raised p-2"><p className="font-mono text-[8px] uppercase tracking-widest2 text-ink-tertiary">{label}</p><p className="mt-1 truncate text-xs font-semibold text-ink">{value}</p></div>;
}

function ResultsScreen({ classYear, settings, picks, prospectById, gradeRows, overallGrade, ddValueCaptured, onReset, onViewBoard }: { classYear: string; settings: MockSettings; picks: MockPick[]; prospectById: Map<string, Prospect>; gradeRows: Array<{ pick: MockPick; player: Prospect; grade: string; valueGain: number; scoreGap: number; tierGap: number }>; overallGrade: string; ddValueCaptured: number; onReset: () => void; onViewBoard: () => void }) {
  const totalScore = gradeRows.reduce((sum, row) => sum + (getScoreForFormat(row.player, settings.qbFormat, settings.teFormat) ?? 0), 0);
  const bestPick = [...gradeRows].sort((a, b) => b.valueGain - a.valueGain)[0];

  // Saved automatically for logged-in users — a few hundred bytes per
  // draft (only ~4-5 picks are ever the user's own, one per round),
  // so there's no real storage cost to doing this by default rather
  // than asking someone to remember to click "save."
  const { user } = useAuth();
  const savedRef = useRef(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [savedDraftId, setSavedDraftId] = useState<string | null>(null);
  const [shareState, setShareState] = useState<"idle" | "copied">("idle");

  const attemptSave = useCallback(() => {
    setSaveState("saving");
    fetch("/api/mock-drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classYear,
        settings,
        overallGrade,
        picks: gradeRows.map((row) => ({
          overall: row.pick.overall,
          playerId: row.player.id,
          playerName: row.player.name,
          position: row.player.position,
          tier: getTierForFormat(row.player, settings.qbFormat, settings.teFormat) ?? null,
          ddScore: getScoreForFormat(row.player, settings.qbFormat, settings.teFormat) ?? null,
          grade: row.grade,
          valueGain: row.valueGain,
          scoreGap: row.scoreGap,
        })),
      }),
    })
      .then(async (res) => {
        setSaveState(res.ok ? "saved" : "error");
        if (res.ok) {
          track("mock_draft_completed", "/mock-draft");
          const data = await res.json().catch(() => null);
          if (data?.id) setSavedDraftId(data.id);
        }
      })
      .catch(() => setSaveState("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user || savedRef.current || gradeRows.length === 0) return;
    savedRef.current = true;
    attemptSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return <section className="mx-auto max-w-4xl"><div className="mb-5 flex items-center justify-between gap-4 px-4 sm:px-0"><div><p className="font-mono text-[10px] uppercase tracking-widest2 text-accent">Draft complete</p><h2 className="mt-1 font-headline text-3xl uppercase leading-none text-ink">Your {classYear} Draft</h2>{user ? (
    <p className="mt-1 flex items-center gap-1.5 font-mono text-[10px] text-ink-tertiary">
      {saveState === "saving" && "Saving to your account…"}
      {saveState === "saved" && <><Check className="h-3 w-3 text-riser" /> Saved to your account</>}
      {saveState === "error" && (
        <>
          Couldn&apos;t save this draft. {" "}
          <button onClick={attemptSave} className="text-accent hover:underline">
            retry
          </button>
        </>
      )}
    </p>
  ) : (
    <Link href={`/login?redirect=/mock-draft`} className="mt-1 inline-block font-mono text-[10px] text-accent hover:underline">
      Log in to save this draft to your account
    </Link>
  )}</div><div className="flex shrink-0 items-center gap-2">{/* Share is genuinely absent (not just hidden) until the save
                    resolves, makes that gap visible instead of the
                    button just silently not being there, which is
                    easy to mistake for the feature not existing at
                    all if someone checks before the save finishes. */}
                {savedDraftId ? (
                  <button onClick={() => { track("mock_draft_shared", "/mock-draft"); navigator.clipboard.writeText(`${window.location.origin}/shared/mock-draft/${savedDraftId}`).then(() => { setShareState("copied"); setTimeout(() => setShareState("idle"), 2000); }).catch(() => {}); }} className="inline-flex items-center gap-2 border border-border-strong px-3 py-2 text-xs text-ink-secondary hover:text-ink">{shareState === "copied" ? <Check className="h-3.5 w-3.5 text-riser" /> : <Share2 className="h-3.5 w-3.5" />} {shareState === "copied" ? "Link copied" : "Share"}</button>
                ) : user && saveState === "saving" ? (
                  <span className="inline-flex items-center gap-2 border border-border-strong px-3 py-2 text-xs text-ink-tertiary opacity-60"><Share2 className="h-3.5 w-3.5" /> Preparing share link…</span>
                ) : null}<button onClick={onViewBoard} className="inline-flex items-center gap-2 border border-border-strong px-3 py-2 text-xs text-ink-secondary hover:text-ink"><LayoutGrid className="h-3.5 w-3.5" /> View draft board</button><button onClick={onReset} className="inline-flex items-center gap-2 border border-border-strong px-3 py-2 text-xs text-ink-secondary hover:text-ink"><RotateCcw className="h-3.5 w-3.5" /> New draft</button></div></div><div className="border border-border bg-surface p-5 sm:p-7"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-mono text-[9px] uppercase tracking-widest2 text-ink-tertiary">Overall draft grade</div><div className={cn("mt-1 font-headline text-7xl leading-none", gradeTone(overallGrade))}>{overallGrade}</div><p className="mt-1 text-sm text-ink-secondary">Based on DD value gained or lost versus the expected value of each draft slot.</p></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3"><ResultStat label="DD Value Captured" value={`${ddValueCaptured.toFixed(1)}%`} /><ResultStat label="Total DD Score" value={totalScore.toFixed(1)} /><ResultStat label="Your Picks" value={String(gradeRows.length)} /></div></div></div><div className="mt-4 border border-border bg-surface"><div className="border-b border-border px-4 py-3"><p className="font-mono text-[9px] uppercase tracking-widest2 text-ink-tertiary">Your picks</p></div>{gradeRows.map((row) => <div key={row.pick.overall} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0"><div className="w-12 shrink-0 font-data text-[10px] text-ink-tertiary">{formatPick(row.pick.overall, settings.teams)}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-ink">{row.player.name}</p><p className="mt-0.5 text-[10px] text-ink-tertiary">{row.player.position} · {getTierForFormat(row.player, settings.qbFormat, settings.teFormat) ?? "TBD"} · DD {getScoreForFormat(row.player, settings.qbFormat, settings.teFormat)?.toFixed(1) ?? "TBD"}</p></div><div className={cn("font-data text-lg font-bold", gradeTone(row.grade))}>{row.grade}</div></div>)}</div><div className="mt-4 grid gap-3 sm:grid-cols-3"><ResultCallout icon={<Trophy className="h-4 w-4" />} title="Best Pick" value={bestPick?.player.name ?? "—"} /><ResultCallout icon={<Zap className="h-4 w-4" />} title="Largest Value Miss" value={gradeRows.length ? `${Math.max(...gradeRows.map((r) => r.scoreGap)).toFixed(1)} DD points` : "—"} /><ResultCallout icon={<Users className="h-4 w-4" />} title="Engine" value={engineLabel(settings.engine)} /></div></section>;
}

function ResultStat({ label, value }: { label: string; value: string }) { return <div className="border border-border bg-surface-raised p-3"><p className="font-mono text-[8px] uppercase tracking-widest2 text-ink-tertiary">{label}</p><p className="mt-1 text-lg font-semibold text-ink">{value}</p></div>; }
function ResultCallout({ icon, title, value }: { icon: ReactNode; title: string; value: string }) { return <div className="border border-border bg-surface p-4"><div className="flex items-center gap-2 text-accent">{icon}<span className="font-mono text-[9px] uppercase tracking-widest2 text-ink-tertiary">{title}</span></div><p className="mt-2 truncate text-sm font-semibold text-ink">{value}</p></div>; }

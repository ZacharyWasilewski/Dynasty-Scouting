"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Filter,
  Link2,
  Pause,
  Play,
  RotateCcw,
  Search,
  Share2,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import type { Prospect } from "@/types/prospect";
import { buildRanksWithinCollection, type LeagueFormat } from "@/lib/ddScore";
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
import { track } from "@/lib/track";
import { ScoreRing } from "@/components/profile/ScoreRing";
import { getTierColor, getTierForScore, getOpportunityColor } from "@/lib/tiers";
import { subScoreSlug, subScoreDescription } from "@/lib/methodologySlugs";
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
  RB: "bg-[#16A34A]/15 text-[#16A34A] border-[#16A34A]/35",
  WR: "bg-[#0EA5E9]/15 text-[#0C7DAD] border-[#0EA5E9]/35",
  TE: "bg-[#A855F7]/15 text-[#8B4FD6] border-[#A855F7]/35",
};

const POSITION_DOT: Record<string, string> = {
  QB: "bg-[#2563EB]",
  RB: "bg-[#16A34A]",
  WR: "bg-[#0C7DAD]",
  TE: "bg-[#8B4FD6]",
};


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
  const initialProspects = classProspectsByYear[classYear] ?? [];
  // Future/devy classes (no real NFL draft has happened yet) have no
  // Community Rankings source and no DD Score — see getScoreForFormat's
  // Pre-Draft Score fallback in lib/mockDraft.ts for the scoring side.
  const isPreDraftClass = initialProspects.length > 0 && initialProspects.every((p) => p.hasDraftData !== true);

  const [mode, setMode] = useState<"new" | "existing" | null>(null);
  const [step, setStep] = useState<"setup" | "draft" | "results">("setup");
  const { user } = useAuth();
  const [syncedNeeds, setSyncedNeeds] = useState<SyncedTeamNeeds | null>(null);

  // Real pick order — see computeRealDraftOrder in lib/teamNeeds.ts.
  // Off by default even when a team is synced, since it changes the
  // team-count preset and turn order in a way that should be an
  // explicit, visible choice, not a silent default.
  const [useRealPickOrder, setUseRealPickOrder] = useState(false);
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
  const [slot, setSlot] = useState(1);
  const [engine, setEngine] = useState<MockEngine>("DD");
  const [pickTimer, setPickTimer] = useState<MockPickTimer>("UNTIMED");
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [picks, setPicks] = useState<MockPick[]>([]);
  const [availableIds, setAvailableIds] = useState<Set<string>>(
    () => new Set(initialProspects.map((p) => p.id))
  );
  const [existingPickIndex, setExistingPickIndex] = useState(0);
  const [existingPlayerSearch, setExistingPlayerSearch] = useState("");
  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState<"ALL" | "QB" | "RB" | "WR" | "TE" | "SUGGESTED">("ALL");
  const [community, setCommunity] = useState<Map<string, CommunityPlayer>>(new Map());
  const [communitySource, setCommunitySource] = useState<string>("loading");
  const [computerThinking, setComputerThinking] = useState(false);
  const [expandedPick, setExpandedPick] = useState<number | null>(null);
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const [mobilePlayerTab, setMobilePlayerTab] = useState<"available" | "selected">("available");
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
  const isUserTurn = deriveIsUserTurn(currentOverall, currentSlot, slot, userPickNumbers);
  const manualEntryLimit = deriveManualEntryLimit(userPickNumbers, slot);
  const MAX_ROUNDS = 4;
  const draftComplete = currentOverall > Math.min(initialProspects.length, teams * MAX_ROUNDS);
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
        // dynasty player pool. TE+ is applied as a percentile bump to the
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
      if (!availableIds.has(player.id) || currentOverall > maxPicks) return;
      const pick: MockPick = {
        overall: currentOverall,
        round: currentRound,
        slot: currentSlot,
        playerId: player.id,
        userPick,
      };
      setPicks((prev) => [...prev, pick]);
      setAvailableIds((prev) => {
        const next = new Set(prev);
        next.delete(player.id);
        return next;
      });
      playPickSound();
    },
    [availableIds, currentOverall, currentRound, currentSlot, maxPicks]
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

    computerTimerRef.current = window.setTimeout(() => {
      computerTimerRef.current = null;
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
  }, [available.length, community.size, communitySource, currentOverall, draftComplete, engine, existingPickIndex, isUserTurn, makePick, mode, paused, slot, step, userPickNumbers]);

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

    pickTimerIntervalRef.current = window.setInterval(() => {
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
        if (!syncedNeeds) return false;
        // BPA mode: no position restriction at all — `available` is
        // already ranked, so this just shows the best players overall.
        if (!syncedNeeds.bpaMode && !isPositionStillSuggested(p.position, syncedNeeds, userPositionCounts)) {
          return false;
        }
      } else if (positionFilter !== "ALL" && p.position !== positionFilter) {
        return false;
      }
      if (!q) return true;
      return `${p.name} ${p.school ?? ""}`.toLowerCase().includes(q);
    });
  }, [available, positionFilter, search, syncedNeeds, userPositionCounts]);

  const existingCandidates = useMemo(() => {
    const q = existingPlayerSearch.trim().toLowerCase();
    return sortedProspects.filter((p) => !picks.some((pick) => pick.playerId === p.id) && (!q || p.name.toLowerCase().includes(q))).slice(0, 12);
  }, [existingPlayerSearch, picks, sortedProspects]);

  const selectNewDraft = () => setMode("new");
  const selectExistingDraft = () => setMode("existing");

  const startSelectedDraft = () => {
    if (!mode) return;
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
    setPicks((prev) => [...prev, { overall, round, slot: pickSlot, playerId: player.id, userPick: pickSlot === slot }]);
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

  const userPicks = picks.filter((p) => p.slot === slot).map((p) => prospectById.get(p.playerId)).filter(Boolean) as Prospect[];

  const gradeRows = useMemo(() => {
    const rows: Array<{ pick: MockPick; player: Prospect; grade: string; valueGain: number; scoreGap: number; tierGap: number }> = [];
    for (const pick of picks.filter((p) => p.slot === slot)) {
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
  }, [initialProspects, picks, prospectById, settings, slot, sortedProspects]);

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
      <section className="mx-auto max-w-5xl pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-0">
        <div className="mb-5 flex items-end justify-between gap-4 px-4 sm:mb-6 sm:px-0">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-widest2 text-accent">Mock Draft Engine</p>
            <h2 className="mt-2 font-headline text-3xl uppercase leading-none tracking-tight text-ink sm:text-4xl">Build your draft</h2>
          </div>
          <div className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary sm:flex">
            <span className="h-2 w-2 rounded-full bg-accent" /> {classYear} class
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
                Synced with <span className="font-semibold text-ink">{syncedNeeds.teamName}</span> —{" "}
                {syncedNeeds.bpaMode
                  ? "your roster is solid everywhere, so picks will lean toward best player available."
                  : `picks at your needs (${syncedNeeds.needs.filter((n) => n.needScore > 0).map((n) => n.position).join(", ")}) will be flagged during the draft, and update as you pick.`}
                {" "}QB format and TE premium below were set to match your league automatically.
              </span>
            </div>
            {/* Applies to both "Start New Draft" and "Continue
                Existing Draft" below — it changes whose turn it
                actually is throughout the draft (via real trade
                data), not which mode you're in. */}
            <label className="flex cursor-pointer items-center gap-2.5 border-t border-accent/20 pt-3">
              <span className="relative inline-flex h-5 w-9 shrink-0 items-center">
                <input
                  type="checkbox"
                  checked={useRealPickOrder}
                  onChange={(e) => setUseRealPickOrder(e.target.checked)}
                  className="peer sr-only"
                />
                <span className="absolute inset-0 rounded-full bg-border-strong transition-colors peer-checked:bg-accent" />
                <span className="absolute left-0.5 h-4 w-4 rounded-full bg-void transition-transform peer-checked:translate-x-4" />
              </span>
              <span className="text-ink-secondary">
                <span className="font-semibold text-ink">Use real pick order</span> from {syncedNeeds.leagueName} —
                reflects actual trades, so who&apos;s on the clock at each pick matches your real league instead of a
                standard slot.
                {realOrderLoading && " Loading…"}
                {useRealPickOrder && !realOrderLoading && realOrderPicks && (
                  <span className="text-riser"> Loaded — {teams} teams, {userPickNumbers?.size ?? 0} of your own picks.</span>
                )}
                {useRealPickOrder && !realOrderLoading && realOrderNotDetermined && (
                  <span className="text-[#FACC15]">
                    {" "}Not available yet — the {classYear} class&apos;s draft order depends on your league&apos;s{" "}
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

        <div className="grid gap-4 lg:gap-5 lg:grid-cols-[1fr_1.1fr]">
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
                  <p className="mt-1.5 text-sm text-ink">{teams} — set by your real league</p>
                </div>
              ) : (
                <Segment label="Teams" options={[10, 12, 14]} value={teams} onChange={(v) => { setTeams(v as MockLeagueSize); setSlot(Math.min(slot, v as number)); }} />
              )}
              {useRealPickOrder && realOrderPicks ? (
                <div className="border border-accent/30 bg-accent/5 p-3">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-widest2 text-ink-tertiary">QB format</p>
                  <p className="mt-1.5 text-sm text-ink">{qbFormat === "SUPERFLEX" ? "Superflex" : "1 QB"} — set by your real league</p>
                </div>
              ) : (
                <Segment label="QB format" options={["1QB", "SUPERFLEX"]} value={qbFormat} onChange={(v) => setQbFormat(v as MockQBFormat)} display={(v) => v === "SUPERFLEX" ? "Superflex" : "1 QB"} />
              )}
              {useRealPickOrder && realOrderPicks ? (
                <div className="border border-accent/30 bg-accent/5 p-3">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-widest2 text-ink-tertiary">TE premium</p>
                  <p className="mt-1.5 text-sm text-ink">{teFormat === "TEP" ? "TE+" : "Standard"} — set by your real league</p>
                </div>
              ) : (
                <Segment label="TE premium" options={["STANDARD", "TEP"]} value={teFormat} onChange={(v) => setTeFormat(v as MockTEFormat)} display={(v) => v === "STANDARD" ? "Standard" : "TE+"} />
              )}
              {useRealPickOrder && realOrderPicks ? (
                <div className="border border-accent/30 bg-accent/5 p-3">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-widest2 text-ink-tertiary">Your picks</p>
                  <p className="mt-1.5 text-sm text-ink">
                    {userPickNumbers && userPickNumbers.size > 0
                      ? [...userPickNumbers].sort((a, b) => a - b).map((n) => formatPick(n, teams)).join(", ")
                      : "None found — you may not own any picks this class."}
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
              <EngineCard active={engine === "DD"} onClick={() => setEngine("DD")} title="Dynasty Database" short="DD" description={isPreDraftClass ? "Our rankings, scores, tiers and probability-based engine — using Pre-Draft Score for this class." : "Our rankings, scores, tiers and probability-based engine."} />
              <div className={cn("relative", isPreDraftClass && "opacity-50")}>
                <EngineCard
                  active={engine === "COMMUNITY"}
                  onClick={() => { if (!isPreDraftClass) setEngine("COMMUNITY"); }}
                  title="Community Rankings"
                  short="CR"
                  description="FantasyCalc market rankings drive the computer picks (TE+ formats use the site’s percentile TE adjustment)."
                />
                {isPreDraftClass && (
                  <div className="absolute inset-0 flex items-center justify-center bg-surface/75 backdrop-blur-[1px]">
                    <span className="border border-border-strong bg-surface px-3 py-1 font-mono text-[9px] font-semibold uppercase tracking-widest2 text-ink-tertiary">
                      Coming soon — no {classYear} rankings yet
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 border-t border-border pt-4 sm:mt-5 sm:pt-5">
              <div className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-widest2 text-ink-tertiary"><span className="h-5 w-5 border border-border-strong bg-surface-raised text-center leading-5 text-accent">3</span> Draft type</div>
              <div className="mt-3 grid gap-2.5 sm:gap-3">
                <DraftTypeCard active={mode === "new"} onClick={selectNewDraft} title="Start New Draft" description="Start a draft from scratch, pick a slot and practice against our Mock Draft Engine, based on our rankings." />
                <DraftTypeCard active={mode === "existing"} onClick={selectExistingDraft} title="Continue Existing Draft" description="Put yourself in the real world, set the board up to replicate how it’s fallen in your league, and start the draft from there." />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 border border-border bg-surface p-3 pb-5 sm:mt-5 sm:p-4 sm:pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-ink-secondary">
            {["Linear rookie draft", `${teams} teams`, qbFormat === "SUPERFLEX" ? "Superflex" : "1 QB", ...(teFormat === "TEP" ? ["TEP"] : []), formatPickTimerLabel(pickTimer)].join(" · ")}
          </div>
          <button
            type="button"
            onClick={startSelectedDraft}
            disabled={!mode}
            className={cn(
              "inline-flex min-h-12 w-full items-center justify-center gap-2 px-5 py-3 text-sm font-semibold transition-colors sm:w-auto",
              mode ? "bg-accent text-white hover:bg-accent-dim" : "cursor-not-allowed bg-surface-raised text-ink-tertiary"
            )}
          >
            {!mode ? "Select Draft Type" : mode === "existing" ? "Start Existing Draft" : "Start Draft"}<ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </section>
    );
  }

  if (step === "results") {
    return <ResultsScreen classYear={classYear} settings={settings} picks={picks} prospectById={prospectById} gradeRows={gradeRows} overallGrade={overallGrade} ddValueCaptured={ddValueCaptured} onReset={resetDraft} />;
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
              <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary"><span>Pick {formatPick(existingPickIndex + 1, teams)}</span><span>{existingPickIndex + 1} of {manualEntryLimit}</span></div>
              <div className="mt-3 flex items-center gap-2 border border-border-strong bg-surface-raised px-3 py-2.5"><Search className="h-4 w-4 text-ink-tertiary" /><input value={existingPlayerSearch} onChange={(e) => setExistingPlayerSearch(e.target.value)} placeholder="Find player" className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-tertiary" /></div>
              <div className="mt-2 max-h-56 overflow-y-auto divide-y divide-border overscroll-contain pb-3">
                {existingCandidates.map((p) => <button key={p.id} onClick={() => enterExistingPick(p)} className="flex w-full items-center justify-between px-2 py-2.5 text-left hover:bg-surface-raised"><span><span className="font-medium text-ink">{p.name}</span><span className="ml-2 text-xs text-ink-tertiary">{p.position}</span></span><span className="font-mono text-xs text-ink-secondary">#{playerRankLabel(p, settings, ddRankMap)}</span></button>)}
              </div>
            </div>
            <div className="border border-border bg-surface p-3">
              <p className="font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary">Already entered</p>
              <div className="mt-2 space-y-1.5">{picks.slice(-6).map((pick) => { const p = prospectById.get(pick.playerId); return <div key={pick.overall} className="flex items-center justify-between text-xs"><span className="font-mono text-ink-tertiary">{formatPick(pick.overall, teams)}</span><span className="truncate px-2 text-ink-secondary">{p?.name}</span><span className="text-ink-tertiary">{p?.position}</span></div>; })}</div>
            </div>
          </div>
        </div>
      )}

      <div className="shrink-0 flex flex-col gap-2 border-b border-border bg-surface px-3 py-2.5 sm:mb-3 sm:flex-row sm:items-center sm:justify-between sm:border sm:px-4 sm:py-3">
        <div className="flex items-center gap-3">
          <button onClick={resetDraft} className="flex h-9 w-9 items-center justify-center border border-border-strong text-ink-secondary hover:border-accent hover:text-accent"><ArrowLeft className="h-4 w-4" /></button>
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
          <div><div className="flex items-center gap-2"><h2 className="text-sm font-semibold text-ink">{classYear} Mock Draft</h2><span className="border border-accent/30 bg-accent/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest2 text-accent">{engineLabel(engine)}</span>{paused && <span className="border border-accent/30 bg-accent/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest2 text-accent">Paused</span>}</div><p className="mt-0.5 text-[11px] text-ink-tertiary">{[`${teams} teams`, qbFormat === "SUPERFLEX" ? "Superflex" : "1 QB", ...(teFormat === "TEP" ? ["TEP"] : []), formatPickTimerLabel(pickTimer), "Linear"].join(" · ")}</p></div>
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
              <span className={cn("font-mono text-2xl font-bold tabular-nums", remainingSeconds <= 10 ? "text-faller" : "text-ink")}>
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

      <div className="mock-draft-layout flex min-h-0 min-w-0 flex-1 flex-col gap-0 lg:grid lg:grid-cols-[minmax(0,1.35fr)_minmax(360px,.85fr)] lg:gap-4">
        <div className="mock-draft-board-panel flex h-[58%] min-h-0 min-w-0 shrink-0 flex-col border-b border-border bg-void lg:h-auto lg:min-h-0 lg:border lg:border-border">
          <div className="flex shrink-0 items-center justify-between border-b border-border bg-surface px-3 py-2 sm:px-4 sm:py-3">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest2 text-ink-tertiary">Draft board</p>
              <div className="mt-1 flex items-center gap-2">
                <p className="mock-draft-pick-label text-sm font-semibold text-ink">Round {currentRound} · Pick {formatPick(currentOverall, teams)}</p>
                {isUserTurn && (
                  <span className="inline-flex shrink-0 items-center gap-1 border border-accent/40 bg-accent/10 px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-widest2 text-accent">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Your Pick
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest2 text-ink-tertiary">
              <ChevronLeft className="h-4 w-4" /> swipe <ChevronRight className="h-4 w-4" />
            </div>
          </div>

          <div ref={draftBoardScrollRef} className="mock-board-scroll min-h-0 flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain lg:h-auto lg:max-h-[calc(100vh-17rem)] lg:overflow-auto">
            <div className="p-2 sm:p-3" style={{ minWidth: `${teams * 116}px` }}>
              <div className="grid" style={{ gridTemplateColumns: `repeat(${teams}, minmax(112px, 1fr))` }}>
                {Array.from({ length: teams }, (_, i) => i + 1).map((team) => (
                  <div key={team} className={cn("border-b border-r border-border bg-surface px-2 py-2.5", team === slot && "bg-accent/10")}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-[9px] font-semibold", team === slot ? "border-accent bg-accent/10 text-accent" : "border-border-strong bg-surface-raised text-ink-tertiary")}>{team}</span>
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
                    const isCurrent = overall === currentOverall;
                    return (
                      <button
                        key={overall}
                        type="button"
                        onClick={() => pick && setExpandedPick(expandedPick === overall ? null : overall)}
                        className={cn(
                          "relative min-h-[54px] border-b border-r border-border bg-surface p-2 text-left transition-colors",
                          team === slot && "bg-accent/5",
                          isCurrent && "bg-accent/10 ring-1 ring-inset ring-accent",
                          pick && "hover:bg-surface-raised"
                        )}
                      >
                        <span className="absolute right-2 top-2 font-mono text-[9px] text-ink-tertiary">{formatPick(overall, teams)}</span>
                        {player ? (
                          <>
                            <div className="pt-6">
                              <span className={cn("absolute left-2 top-2 inline-flex border px-1.5 py-0.5 font-mono text-[8px] font-semibold", POSITION_CLASS[player.position])}>{player.position}</span>
                              <p className="mt-1 line-clamp-3 break-words text-[11px] font-semibold leading-tight text-ink">{player.name}</p>
                              <p className="mt-1 font-mono text-[9px] text-ink-tertiary">DD {getScoreForFormat(player, qbFormat, teFormat)?.toFixed(1) ?? "TBD"}</p>
                            </div>
                            {player.photoUrl && (
                              <Image
                                src={player.photoUrl}
                                alt=""
                                width={36}
                                height={36}
                                unoptimized
                                className="absolute bottom-1 right-1 h-9 w-9 rounded-full object-cover opacity-90"
                              />
                            )}
                          </>
                        ) : isCurrent ? (
                          <div className="flex h-full min-h-[48px] items-center justify-center">
                            <div className="text-center">
                              <Sparkles className="mx-auto h-4 w-4 text-accent" />
                              <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest2 text-accent">{isUserTurn ? "Your pick" : "On the clock"}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex h-full min-h-[48px] items-end justify-end"><span className="font-mono text-[10px] text-ink-tertiary">—</span></div>
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
            ) : computerThinking ? (
              <div className="flex items-center gap-2 text-xs text-ink-secondary"><span className="h-2 w-2 animate-pulse rounded-full bg-accent" /> {engineLabel(engine)} is making a pick…</div>
            ) : isUserTurn ? (
              <div className="flex items-center justify-between gap-3">
                <div><p className="font-mono text-[9px] uppercase tracking-widest2 text-accent">On the clock</p><p className="mt-1 text-sm font-semibold text-ink">Your pick: {formatPick(currentOverall, teams)}</p></div>
                {pickTimer === "UNTIMED" || remainingSeconds === null ? (
                  <span className="font-mono text-[9px] uppercase tracking-widest2 text-ink-tertiary">No timer</span>
                ) : (
                  <span className={cn("font-mono text-2xl font-bold tabular-nums", remainingSeconds <= 10 ? "text-faller" : "text-ink")}>
                    {formatCountdown(remainingSeconds)}
                  </span>
                )}
              </div>
            ) : (
              <div className="text-xs text-ink-secondary">Waiting for the computer to select {formatPick(currentOverall, teams)}.</div>
            )}
          </div>
          <div className="hidden border-t border-border bg-surface lg:block">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div><p className="font-mono text-[9px] uppercase tracking-widest2 text-ink-tertiary">Selected players</p><p className="mt-1 text-sm font-semibold text-ink">Your picks</p></div>
              <span className="font-mono text-[10px] text-ink-tertiary">{userPicks.length}</span>
            </div>
            <div className="overflow-visible">
              {userPicks.length ? userPicks.map((p) => { const pick = picks.find((x) => x.playerId === p.id); return <div key={p.id} className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-0"><span className="w-10 shrink-0 font-mono text-[9px] text-ink-tertiary">{pick ? formatPick(pick.overall, teams) : "—"}</span><span className={cn("h-2 w-2 shrink-0 rounded-full", POSITION_DOT[p.position])} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-ink">{p.name}</p><p className="mt-0.5 text-[9px] text-ink-tertiary">{p.position} · DD {getScoreForFormat(p, qbFormat, teFormat)?.toFixed(1) ?? "TBD"}</p></div></div>; }) : <div className="p-5 text-center text-xs text-ink-tertiary">No players selected yet.</div>}
            </div>
          </div>
        </div>

        <div className={cn("mock-player-panel relative z-20 flex min-h-0 min-w-0 flex-col border-t border-border bg-surface lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-hidden lg:border", mobilePlayersExpanded ? "mobile-expanded" : "h-[42%]", "lg:static lg:h-auto lg:shadow-none")}>
          <div
            className="mock-player-sheet-handle shrink-0 border-b border-border px-3 py-2.5 sm:px-4 sm:py-3"
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
            <button type="button" aria-label={mobilePlayersExpanded ? "Collapse players" : "Expand players"} onClick={() => setMobilePlayersExpanded((v) => !v)} className="mx-auto mb-2 block h-1.5 w-10 rounded-full bg-border-strong lg:hidden" />
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1">
                <button type="button" onClick={() => { setMobilePlayerTab("available"); setMobilePlayersExpanded(false); }} className={cn("px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest2", mobilePlayerTab === "available" ? "text-accent" : "text-ink-tertiary")}>Available</button>
                <button type="button" onClick={() => { setMobilePlayerTab("selected"); setMobilePlayersExpanded(false); }} className={cn("px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest2", mobilePlayerTab === "selected" ? "text-accent" : "text-ink-tertiary")}>Selected</button>
              </div>
              <span className="font-mono text-[10px] text-ink-tertiary">{mobilePlayerTab === "available" ? `${available.length} left` : `${userPicks.length} selected`}</span>
            </div>
          </div>

          <div className={cn("border-b border-border p-3", mobilePlayerTab === "selected" && "hidden lg:block")}>
            <div className="flex items-center gap-2 border border-border-strong bg-surface-raised px-3 py-2.5">
              <Search className="h-4 w-4 text-ink-tertiary" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search players" className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-tertiary" />
              <Filter className="h-4 w-4 text-ink-tertiary" />
            </div>
            <div className="mt-2 flex gap-1 overflow-x-auto pb-1">
              {syncedNeeds && (
                <button
                  type="button"
                  onClick={() => setPositionFilter("SUGGESTED")}
                  className={cn(
                    "shrink-0 border px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest2 transition-colors",
                    positionFilter === "SUGGESTED" ? "border-accent bg-accent text-white" : "border-accent/50 bg-accent/10 text-accent hover:bg-accent/20"
                  )}
                >
                  {syncedNeeds.bpaMode ? "Best Available" : "Suggested"}
                </button>
              )}
              {(["ALL", "QB", "RB", "WR", "TE"] as const).map((pos) => (
                <button key={pos} type="button" onClick={() => setPositionFilter(pos)} className={cn("shrink-0 border px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest2 transition-colors", positionFilter === pos ? "border-accent bg-accent text-white" : "border-border-strong bg-surface text-ink-secondary hover:text-ink")}>{pos === "ALL" ? "All" : pos}</button>
              ))}
            </div>
          </div>

          <div className="mock-player-list min-h-0 flex-1 overflow-y-auto overscroll-y-contain touch-pan-y pb-6 [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch] lg:h-[calc(100vh-15rem)] lg:max-h-[calc(100vh-15rem)]">
            {mobilePlayerTab === "selected" ? (
              userPicks.length ? userPicks.map((p) => (
                <div key={p.id} className="flex items-center gap-3 border-b border-border px-3 py-3 sm:px-4">
                  <span className="w-7 shrink-0 text-right font-mono text-[10px] text-ink-tertiary">{formatPick(picks.find((x) => x.playerId === p.id)?.overall ?? 0, teams)}</span>
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", POSITION_DOT[p.position])} />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-ink">{p.name}</p><p className="mt-1 text-[10px] text-ink-tertiary">{p.position} · DD {getScoreForFormat(p, qbFormat, teFormat)?.toFixed(1) ?? "TBD"}</p></div>
                </div>
              )) : <div className="p-8 text-center text-sm text-ink-tertiary">No players selected yet.</div>
            ) : filteredAvailable.map((p) => {
              const rank = playerRankLabel(p, settings, ddRankMap);
              const score = getScoreForFormat(p, qbFormat, teFormat);
              const tier = getTierForFormat(p, qbFormat, teFormat);
              const communityPlayer =
                community.get(normalizePlayerName(p.name)) ??
                community.get(p.name.trim().toLowerCase()) ??
                community.get(p.name.trim().toLowerCase().replace(/\b(jr|sr|ii|iii|iv|v)\.?$/i, "").trim());
              const cr = communityPlayer?.rank;
              const diff = typeof rank === "number" && cr ? cr - rank : null;
              const canPick = isUserTurn && !computerThinking;
              const isExpanded = expandedPlayerId === p.id;
              const isSuggested =
                positionFilter !== "SUGGESTED" &&
                !!syncedNeeds &&
                !syncedNeeds.bpaMode &&
                isPositionStillSuggested(p.position, syncedNeeds, userPositionCounts);
              return (
                <div key={p.id} className={cn("border-b border-border", canPick && "hover:bg-surface-raised/70")}>
                  <div className="flex items-center gap-2 px-3 py-3 sm:px-4">
                    <span className="w-7 shrink-0 text-right font-mono text-[10px] text-ink-tertiary">{rank}</span>
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", POSITION_DOT[p.position])} />
                    <button
                      type="button"
                      onClick={() => setExpandedPlayerId(isExpanded ? null : p.id)}
                      className="min-w-0 flex-1 text-left"
                      aria-expanded={isExpanded}
                    >
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-ink">{p.name}</span>
                        {isSuggested && (
                          <span className="shrink-0 rounded-full bg-accent/15 px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-widest2 text-accent">
                            Need
                          </span>
                        )}
                        <ChevronRight className={cn("ml-auto h-4 w-4 shrink-0 text-ink-tertiary transition-transform", isExpanded && "rotate-90 text-accent")} />
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-ink-tertiary"><span>{p.position}</span><span>•</span><span>{tier ?? "TBD"}</span><span>•</span><span>DD {score?.toFixed(1) ?? "TBD"}</span><span>•</span><span>COMM {cr ?? "—"}</span></div>
                    </button>
                    <div className="hidden shrink-0 text-right sm:block"><div className="font-mono text-[9px] text-ink-tertiary">COMM</div><div className={cn("font-mono text-xs font-semibold", diff === null ? "text-ink-tertiary" : diff > 0 ? "text-riser" : diff < 0 ? "text-faller" : "text-ink-secondary")}>{cr ?? "—"}{diff !== null && <span className="ml-1 text-[9px]">{diff > 0 ? `+${diff}` : diff}</span>}</div></div>
                    {canPick && <button type="button" onClick={() => makePick(p, true)} className="shrink-0 bg-accent px-3 py-2 text-xs font-semibold text-white hover:bg-accent-dim">Pick</button>}
                  </div>

                  {isExpanded && (
                    <div className="border-t border-border bg-surface-raised/40 px-3 py-2.5 sm:px-4">
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <Stat label="DD Rank" value={`#${rank}`} />
                        <Stat label="DD Score" value={score?.toFixed(1) ?? "TBD"} />
                        <Stat label="Tier Hit Rate" value={tier ? (positionTierHitRates.get(`${p.position}:${tier}`) !== undefined ? `${positionTierHitRates.get(`${p.position}:${tier}`)!.toFixed(1)}%` : "N/A") : "N/A"} />
                        <Stat label="Community" value={cr ? `#${cr}${diff !== null ? ` (${diff > 0 ? "+" : ""}${diff})` : ""}` : "—"} />
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)]">
                        <div className="min-w-0">
                          <p className="font-mono text-[9px] uppercase tracking-widest2 text-ink-tertiary">Model subscores</p>
                          {p.subScores?.length ? (
                            <div className="mt-3 grid grid-cols-3 gap-x-2 gap-y-3 justify-items-center">
                              {p.subScores.map((sub, index) => (
                                <div key={sub.label} className={cn("w-[54px] shrink-0", index === p.subScores!.length - 1 && p.subScores!.length % 3 === 2 && "col-start-2")}>
                                  <ScoreRing
                                    label={sub.label}
                                    value={sub.value}
                                    text={sub.text}
                                    size={48}
                                    decimals={0}
                                    info={subScoreDescription(p.position, sub.label)}
                                    infoHref={`/methodology#${subScoreSlug(p.position, sub.label)}`}
                                    color={
                                      sub.isPending
                                        ? "var(--color-border-strong)"
                                        : sub.value === 100
                                        ? "#7C3AED"
                                        : sub.isElite
                                        ? getTierColor("Elite")
                                        : sub.value !== undefined
                                        ? getTierColor(getTierForScore(sub.value) ?? "Roster Clogger")
                                        : getOpportunityColor(p.position, sub.text)
                                    }
                                  />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              <Stat label="Positional" value={p.positionalScore?.toFixed(1) ?? "TBD"} />
                              <Stat label="Pre-Draft" value={p.preDraftScore?.toFixed(1) ?? "TBD"} />
                              <Stat label="Opportunity" value={p.opportunityScore?.toFixed(1) ?? "TBD"} />
                              <Stat label="Draft Capital" value={p.draftProjection?.range ?? "—"} />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-mono text-[9px] uppercase tracking-widest2 text-ink-tertiary">Quick context</p>
                          <div className="mt-2 space-y-2 text-xs text-ink-secondary">
                            <p><span className="text-ink-tertiary">DD vs Community:</span> {diff === null ? "Community rank unavailable" : diff > 0 ? `DD ranks him ${diff} spots higher` : diff < 0 ? `Community ranks him ${Math.abs(diff)} spots higher` : "Ranks are tied"}.</p>
                            {p.draftProjection?.range && <p><span className="text-ink-tertiary">Draft projection:</span> {p.draftProjection.range}</p>}
                            {p.summary && <p className="line-clamp-4"><span className="text-ink-tertiary">Summary:</span> {p.summary}</p>}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
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
            ) : paused ? <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-xs text-ink-secondary"><Pause className="h-3.5 w-3.5 text-accent" /> Draft paused</div><button type="button" onClick={() => setPaused(false)} className="border border-accent/40 bg-accent/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest2 text-accent hover:bg-accent/20">Resume</button></div> : computerThinking ? <div className="flex items-center gap-2 text-xs text-ink-secondary"><span className="h-2 w-2 animate-pulse rounded-full bg-accent" /> {engineLabel(engine)} is making a pick…</div> : isUserTurn ? <div className="flex items-center justify-between gap-3"><div><p className="font-mono text-[9px] uppercase tracking-widest2 text-accent">On the clock</p><p className="mt-1 text-sm font-semibold text-ink">Your pick: {formatPick(currentOverall, teams)}</p></div>{pickTimer === "UNTIMED" || remainingSeconds === null ? <span className="font-mono text-[9px] uppercase tracking-widest2 text-ink-tertiary">No timer</span> : <span className={cn("font-mono text-2xl font-bold tabular-nums", remainingSeconds <= 10 ? "text-faller" : "text-ink")}>{formatCountdown(remainingSeconds)}</span>}</div> : <div className="text-xs text-ink-secondary">Waiting for the computer to select {formatPick(currentOverall, teams)}.</div>}
          </div>
        </div>
      </div>

      {expandedPick && <div className="fixed inset-x-3 bottom-3 z-[60] border border-border bg-surface p-4 shadow-2xl shadow-black/40 sm:left-auto sm:right-6 sm:w-96"><button onClick={() => setExpandedPick(null)} className="absolute right-3 top-3 text-ink-tertiary hover:text-ink"><ChevronDown className="h-4 w-4" /></button>{(() => { const pick = picks.find((x) => x.overall === expandedPick); const prospect = pick ? prospectById.get(pick.playerId) : undefined; if (!pick || !prospect) return null; return <div><p className="font-mono text-[9px] uppercase tracking-widest2 text-ink-tertiary">{formatPick(pick.overall, teams)} · Team {pick.slot}</p><h3 className="mt-1 text-lg font-semibold text-ink">{prospect.name}</h3><div className="mt-3 grid grid-cols-3 gap-2"><Stat label="DD Rank" value={`#${playerRankLabel(prospect, settings, ddRankMap)}`} /><Stat label="DD Score" value={getScoreForFormat(prospect, qbFormat, teFormat)?.toFixed(1) ?? "TBD"} /><Stat label="Tier" value={getTierForFormat(prospect, qbFormat, teFormat) ?? "TBD"} /></div></div>; })()}</div>}
    </section>
  );
}

function Segment<T extends string | number>({ label, options, value, onChange, display }: { label: string; options: readonly T[]; value: T; onChange: (v: T) => void; display?: (v: T) => string }) {
  return <div><label className="mb-2 block font-mono text-[10px] font-semibold uppercase tracking-widest2 text-ink-tertiary">{label}</label><div className="grid grid-cols-3 gap-1">{options.map((option) => <button key={String(option)} onClick={() => onChange(option)} className={cn("border px-2 py-2.5 text-xs font-semibold transition-colors", value === option ? "border-accent bg-accent text-white" : "border-border-strong bg-surface-raised text-ink-secondary hover:text-ink")}>{display ? display(option) : option}</button>)}</div></div>;
}

function EngineCard({ active, onClick, title, short, description }: { active: boolean; onClick: () => void; title: string; short: string; description: string }) {
  return <button onClick={onClick} className={cn("flex items-center gap-3 border p-3 text-left transition-colors", active ? "border-accent bg-accent/5" : "border-border-strong bg-surface-raised hover:border-accent/40")}><span className={cn("flex h-10 w-10 shrink-0 items-center justify-center border font-mono text-xs font-bold", active ? "border-accent bg-accent text-white" : "border-border text-accent")}>{short}</span><span className="min-w-0"><span className="block text-sm font-semibold text-ink">{title}</span><span className="mt-0.5 block text-xs leading-relaxed text-ink-tertiary">{description}</span></span>{active && <Check className="ml-auto h-4 w-4 shrink-0 text-accent" />}</button>;
}

function DraftTypeCard({ active, onClick, title, description }: { active: boolean; onClick: () => void; title: string; description: string }) {
  return <button onClick={onClick} className={cn("border p-3 text-left transition-colors", active ? "border-accent bg-accent/5" : "border-border-strong bg-surface-raised hover:border-accent/40")}><div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold text-ink">{title}</span>{active && <Check className="h-4 w-4 text-accent" />}</div><p className="mt-1 text-xs leading-relaxed text-ink-tertiary">{description}</p></button>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="border border-border bg-surface-raised p-2"><p className="font-mono text-[8px] uppercase tracking-widest2 text-ink-tertiary">{label}</p><p className="mt-1 truncate text-xs font-semibold text-ink">{value}</p></div>;
}

function ResultsScreen({ classYear, settings, picks, prospectById, gradeRows, overallGrade, ddValueCaptured, onReset }: { classYear: string; settings: MockSettings; picks: MockPick[]; prospectById: Map<string, Prospect>; gradeRows: Array<{ pick: MockPick; player: Prospect; grade: string; valueGain: number; scoreGap: number; tierGap: number }>; overallGrade: string; ddValueCaptured: number; onReset: () => void }) {
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
          Couldn&apos;t save this draft —{" "}
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
                    resolves — makes that gap visible instead of the
                    button just silently not being there, which is
                    easy to mistake for the feature not existing at
                    all if someone checks before the save finishes. */}
                {savedDraftId ? (
                  <button onClick={() => { track("mock_draft_shared", "/mock-draft"); navigator.clipboard.writeText(`${window.location.origin}/shared/mock-draft/${savedDraftId}`).then(() => { setShareState("copied"); setTimeout(() => setShareState("idle"), 2000); }).catch(() => {}); }} className="inline-flex items-center gap-2 border border-border-strong px-3 py-2 text-xs text-ink-secondary hover:text-ink">{shareState === "copied" ? <Check className="h-3.5 w-3.5 text-riser" /> : <Share2 className="h-3.5 w-3.5" />} {shareState === "copied" ? "Link copied" : "Share"}</button>
                ) : user && saveState === "saving" ? (
                  <span className="inline-flex items-center gap-2 border border-border-strong px-3 py-2 text-xs text-ink-tertiary opacity-60"><Share2 className="h-3.5 w-3.5" /> Preparing share link…</span>
                ) : null}<button onClick={onReset} className="inline-flex items-center gap-2 border border-border-strong px-3 py-2 text-xs text-ink-secondary hover:text-ink"><RotateCcw className="h-3.5 w-3.5" /> New draft</button></div></div><div className="border border-border bg-surface p-5 sm:p-7"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-mono text-[9px] uppercase tracking-widest2 text-ink-tertiary">Overall draft grade</div><div className={cn("mt-1 font-headline text-7xl leading-none", gradeTone(overallGrade))}>{overallGrade}</div><p className="mt-1 text-sm text-ink-secondary">Based on DD value gained or lost versus the expected value of each draft slot.</p></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3"><ResultStat label="DD Value Captured" value={`${ddValueCaptured.toFixed(1)}%`} /><ResultStat label="Total DD Score" value={totalScore.toFixed(1)} /><ResultStat label="Your Picks" value={String(gradeRows.length)} /></div></div></div><div className="mt-4 border border-border bg-surface"><div className="border-b border-border px-4 py-3"><p className="font-mono text-[9px] uppercase tracking-widest2 text-ink-tertiary">Your picks</p></div>{gradeRows.map((row) => <div key={row.pick.overall} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0"><div className="w-12 shrink-0 font-mono text-[10px] text-ink-tertiary">{formatPick(row.pick.overall, settings.teams)}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-ink">{row.player.name}</p><p className="mt-0.5 text-[10px] text-ink-tertiary">{row.player.position} · {getTierForFormat(row.player, settings.qbFormat, settings.teFormat) ?? "TBD"} · DD {getScoreForFormat(row.player, settings.qbFormat, settings.teFormat)?.toFixed(1) ?? "TBD"}</p></div><div className={cn("font-mono text-lg font-bold", gradeTone(row.grade))}>{row.grade}</div></div>)}</div><div className="mt-4 grid gap-3 sm:grid-cols-3"><ResultCallout icon={<Trophy className="h-4 w-4" />} title="Best Pick" value={bestPick?.player.name ?? "—"} /><ResultCallout icon={<Zap className="h-4 w-4" />} title="Largest Value Miss" value={gradeRows.length ? `${Math.max(...gradeRows.map((r) => r.scoreGap)).toFixed(1)} DD points` : "—"} /><ResultCallout icon={<Users className="h-4 w-4" />} title="Engine" value={engineLabel(settings.engine)} /></div></section>;
}

function ResultStat({ label, value }: { label: string; value: string }) { return <div className="border border-border bg-surface-raised p-3"><p className="font-mono text-[8px] uppercase tracking-widest2 text-ink-tertiary">{label}</p><p className="mt-1 text-lg font-semibold text-ink">{value}</p></div>; }
function ResultCallout({ icon, title, value }: { icon: ReactNode; title: string; value: string }) { return <div className="border border-border bg-surface p-4"><div className="flex items-center gap-2 text-accent">{icon}<span className="font-mono text-[9px] uppercase tracking-widest2 text-ink-tertiary">{title}</span></div><p className="mt-2 truncate text-sm font-semibold text-ink">{value}</p></div>; }

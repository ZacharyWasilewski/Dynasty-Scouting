"use client";

import { Suspense, Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  Search,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  X,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { TierBadge } from "@/components/rankings/TierBadge";
import { SchoolLogo } from "@/components/ui/SchoolLogo";
import { FilterSelect } from "@/components/rankings/FilterSelect";
import { Pagination } from "@/components/rankings/Pagination";
import { ALL_POSITIONS, ALL_TIERS, getDisplayedPreDraftScore } from "@/lib/prospects";
import { getTierColor } from "@/lib/tiers";
import { buildRanksWithinCollection, getDDScore, getDDTier, getRankForFormat, type LeagueFormat } from "@/lib/ddScore";
import { wasRecentBackNavigation, getSavedFormatForPath, saveFormatForPath, VALID_FORMATS } from "@/lib/formatPersistence";
import { getGlobalFormat, reportFormatUsed } from "@/lib/globalFormat";
import { WatchlistButton } from "@/components/watchlist/WatchlistButton";
import type { Position, Tier, Prospect } from "@/types/prospect";

type SortKey =
  | "rank"
  | "name"
  | "position"
  | "school"
  | "draftClass"
  | "preDraftScore"
  | "score"
  | "tier"

const DEFAULT_DIR: Record<SortKey, "asc" | "desc"> = {
  rank: "asc",
  name: "asc",
  position: "asc",
  school: "asc",
  draftClass: "desc",
  preDraftScore: "desc",
  score: "desc",
  tier: "asc",
};

const TIER_ORDER: Record<Tier, number> = {
  Generational: 1,
  Elite: 2,
  Starter: 3,
  Flex: 4,
  "Upside Shot": 5,
  Bench: 6,
  "Taxi Squad": 7,
  "Roster Clogger": 8,
};

const PAGE_SIZE = 50;

const FORMAT_QUERY_PARAM: Record<LeagueFormat, string> = {
  "1QB": "",
  SUPERFLEX: "sf",
  "1QB_TEP": "1qb-tep",
  SUPERFLEX_TEP: "sf-tep",
};

function playerHref(id: string, format: LeagueFormat): string {
  const formatParam = FORMAT_QUERY_PARAM[format];
  return formatParam ? `/players/${id}?format=${formatParam}` : `/players/${id}`;
}

function sortValue(p: Prospect, key: SortKey): string | number {
  switch (key) {
    case "rank":
      return p.rank ?? Number.POSITIVE_INFINITY;
    case "name":
      return p.name.toLowerCase();
    case "position":
      return p.position;
    case "school":
      return (p.school ?? "").toLowerCase();
    case "draftClass":
      return p.draftClass ?? "";
    case "preDraftScore":
      return getDisplayedPreDraftScore(p) ?? -1;
    case "score":
    case "tier":
      // Unreachable in practice — both are intercepted by their own
      // format-aware branches before this function is ever called
      // for them (see the sort comparator below). Kept here only so
      // the switch stays exhaustive against SortKey; the values
      // that used to live here (p.ddScore, p.tier) were the actual
      // bug — static, non-format-aware fields used for sorting while
      // the table displays format-aware ones.
      return 0;
  }
}

export function RankingsTable({
  prospects,
  showBigBoardDividers,
  rankScope,
  onFormatChange,
  showClassColumn,
}: {
  prospects: Prospect[];
  /** Adds visible divider lines between tiers and every 12 picks
   *  (draft rounds) — only makes sense when every row shown belongs
   *  to a single class, so round numbering is meaningful. */
  showBigBoardDividers?: boolean;
  rankScope?: "global" | "collection";
  /** Fires with the table's own QB/TEP format on mount and on every
   *  change, so a parent page can drive other UI (e.g. a chart) off
   *  the exact same switches instead of duplicating them. */
  onFormatChange?: (format: LeagueFormat) => void;
  /** Adds a sortable Class column — only worth showing when the rows
   *  span more than one draft class (e.g. /players, /watchlist);
   *  redundant on a single class's own page. */
  showClassColumn?: boolean;
}) {
  return (
    <Suspense fallback={null}>
      <RankingsTableInner
        prospects={prospects}
        showBigBoardDividers={showBigBoardDividers}
        rankScope={rankScope}
        onFormatChange={onFormatChange}
        showClassColumn={showClassColumn}
      />
    </Suspense>
  );
}

function RankingsTableInner({
  prospects,
  showBigBoardDividers,
  rankScope,
  onFormatChange,
  showClassColumn,
}: {
  prospects: Prospect[];
  showBigBoardDividers?: boolean;
  rankScope?: "global" | "collection";
  onFormatChange?: (format: LeagueFormat) => void;
  showClassColumn?: boolean;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const urlPosition = searchParams.get("position");
  const urlTier = searchParams.get("tier");
  const urlPage = searchParams.get("page");
  const urlFormat = searchParams.get("format");
  const urlQuery = searchParams.get("q") ?? "";
  const urlSort = searchParams.get("sort") as SortKey | null;
  const urlDir = searchParams.get("dir");

  const validSortKeys: SortKey[] = ["rank", "name", "position", "school", "draftClass", "preDraftScore", "score", "tier"];
  const initialSortKey: SortKey = urlSort && validSortKeys.includes(urlSort) ? urlSort : "rank";
  const initialSortDir: "asc" | "desc" = urlDir === "desc" ? "desc" : DEFAULT_DIR[initialSortKey];

  // Format now has two layers: an explicit ?format= URL param always
  // wins (a deliberate deep link), then a genuine browser Back/Forward
  // back to this exact page restores whatever was active here, and
  // otherwise this falls back to the user's sticky cross-page format
  // preference (see lib/globalFormat) instead of hardcoding 1QB —
  // that hardcoded reset was the actual complaint this replaces: a
  // Superflex player had to reselect it on every single page.
  const [format, setFormat] = useState<LeagueFormat>(() => {
    if (urlFormat && (VALID_FORMATS as string[]).includes(urlFormat)) {
      return urlFormat as LeagueFormat;
    }
    if (wasRecentBackNavigation()) {
      const restored = getSavedFormatForPath(pathname);
      if (restored) return restored;
    }
    return getGlobalFormat();
  });
  const collectionRankMap = useMemo(() => rankScope === "collection" ? buildRanksWithinCollection(prospects, format) : null, [prospects, format, rankScope]);
  // Report the table's own format up to the parent (e.g. so a chart above
  // this table can mirror the exact same QB/TEP switches) — fires on
  // mount and on every subsequent change, never the other way around.
  useEffect(() => {
    onFormatChange?.(format);
  }, [format, onFormatChange]);
  const [query, setQuery] = useState(urlQuery);
  const [position, setPosition] = useState<Position | "all">(
    urlPosition && ALL_POSITIONS.includes(urlPosition as Position)
      ? (urlPosition as Position)
      : "all"
  );
  const [tier, setTier] = useState<Tier | "all">(
    urlTier && ALL_TIERS.includes(urlTier as Tier) ? (urlTier as Tier) : "all"
  );
  const [sortKey, setSortKey] = useState<SortKey>(initialSortKey);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(initialSortDir);
  const [page, setPageState] = useState(() => {
    const n = urlPage ? Number(urlPage) : 1;
    return Number.isFinite(n) && n > 0 ? n : 1;
  });

  // Keep this page's own format persisted per-path so a genuine browser
  // Back/Forward back to this exact page can restore it (see the
  // initializer above and lib/formatPersistence), and also report it
  // as the user's sticky cross-page preference (lib/globalFormat) so
  // every other page defaults to it going forward too.
  useEffect(() => {
    saveFormatForPath(pathname, format);
    reportFormatUsed(format);
  }, [pathname, format]);

  // An incoming ?format= param (e.g. a Tier Hit Rate deep link) has
  // already been consumed by the format initializer above — strip it
  // from the URL afterward so the address bar stays clean.
  useEffect(() => {
    if (!urlFormat) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("format");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams, urlFormat]);

  // Keeps the current page in the URL (via replace, not push, so it
  // doesn't spam browser history) — that way, clicking into a player
  // from page 3 and hitting back returns to page 3, not page 1.
  function setPage(newPage: number) {
    setPageState(newPage);
    const params = new URLSearchParams(searchParams.toString());
    if (newPage <= 1) params.delete("page");
    else params.set("page", String(newPage));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const filtersActive =
    query.trim() !== "" || position !== "all" || tier !== "all";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return prospects.filter((p) => {
      const school = (p.school ?? "").toLowerCase();
      if (q && !p.name.toLowerCase().includes(q) && !school.includes(q)) return false;
      if (position !== "all" && p.position !== position) return false;
      if (tier !== "all" && getDDTier(p, format) !== tier) return false;
      return true;
    });
  }, [prospects, query, position, tier, format]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      if (sortKey === "rank") {
        const rankFor = (p: Prospect) => collectionRankMap?.get(p.id) ?? getRankForFormat(p, format) ?? Number.POSITIVE_INFINITY;
        return rankFor(a) - rankFor(b);
      }
      if (sortKey === "score") {
        const av = getDDScore(a, format) ?? -1;
        const bv = getDDScore(b, format) ?? -1;
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return sortDir === "asc" ? cmp : -cmp;
      }
      if (sortKey === "tier") {
        const av = getDDTier(a, format) ? TIER_ORDER[getDDTier(a, format)!] : 99;
        const bv = getDDTier(b, format) ? TIER_ORDER[getDDTier(b, format)!] : 99;
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return sortDir === "asc" ? cmp : -cmp;
      }
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDir, format, collectionRankMap]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // If the displayed prospects are still missing either real ADP or OPP,
  // this column is the forward-looking Pre-Draft Score. Otherwise it is
  // the completed positional score.
  const isPreDraftView = filtered.length > 0 && filtered.every((p) => !p.hasDraftData);
  const scoreColumnLabel = isPreDraftView ? "Pre-Draft Score" : "POS Score";

  function replaceListingParams(update: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    update(params);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function resetPageParam(params: URLSearchParams) {
    params.delete("page");
  }

  function handleSort(key: SortKey) {
    const nextDir = key === sortKey ? (sortDir === "asc" ? "desc" : "asc") : DEFAULT_DIR[key];
    setSortKey(key);
    setSortDir(nextDir);
    setPageState(1);
    replaceListingParams((params) => {
      if (key === "rank" && nextDir === "asc") params.delete("sort");
      else params.set("sort", key);
      if (nextDir === "asc") params.delete("dir");
      else params.set("dir", nextDir);
      resetPageParam(params);
    });
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    setPageState(1);
    replaceListingParams((params) => {
      if (value.trim()) params.set("q", value);
      else params.delete("q");
      resetPageParam(params);
    });
  }

  function handlePositionChange(value: Position | "all") {
    setPosition(value);
    setPageState(1);
    replaceListingParams((params) => {
      if (value === "all") params.delete("position");
      else params.set("position", value);
      resetPageParam(params);
    });
  }

  function handleTierChange(value: Tier | "all") {
    setTier(value);
    setPageState(1);
    replaceListingParams((params) => {
      if (value === "all") params.delete("tier");
      else params.set("tier", value);
      resetPageParam(params);
    });
  }

  function clearFilters() {
    setQuery("");
    setPosition("all");
    setTier("all");
    setPageState(1);
    replaceListingParams((params) => {
      params.delete("q");
      params.delete("position");
      params.delete("tier");
      resetPageParam(params);
    });
  }

  const rangeStart = sorted.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  // Watchlist + Rank + Player + Pos + School + [Class] + Pre-Draft/DD Score + Tier
  const columnCount = showClassColumn ? 9 : 8;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, sorted.length);

  // Shared by both the QB and TEP toggles below — they were each
  // duplicating this exact set-state-then-sync-URL sequence, which
  // meant any future change to the format→query-param mapping had to
  // be made correctly in two places or the two toggles could silently
  // drift out of sync with each other.
  function applyFormat(nextFormat: LeagueFormat) {
    setFormat(nextFormat);
    const params = new URLSearchParams(searchParams.toString());
    if (nextFormat === "1QB") params.delete("format");
    else if (nextFormat === "SUPERFLEX") params.set("format", "sf");
    else if (nextFormat === "1QB_TEP") params.set("format", "1qb-tep");
    else params.set("format", "sf-tep");
    params.delete("page");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div>
      {/* TOOLBAR */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" />
          <input
            type="search"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search player or school"
            aria-label="Search player or school"
            className="w-full border border-border-strong bg-surface py-2.5 pl-9 pr-3 text-base text-ink placeholder:text-ink-tertiary transition-colors duration-150 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/10"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex h-9 border border-border-strong bg-surface p-0.5" role="group" aria-label="Quarterback format">
              {(["1QB", "SUPERFLEX"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    const nextFormat: LeagueFormat = format === "1QB_TEP" || format === "SUPERFLEX_TEP"
                      ? (value === "SUPERFLEX" ? "SUPERFLEX_TEP" : "1QB_TEP")
                      : value;
                    applyFormat(nextFormat);
                  }}
                  className={cn(
                    "h-full whitespace-nowrap px-2.5 font-mono text-[10px] font-semibold uppercase tracking-widest2 transition-colors sm:px-3 sm:text-[11px]",
                    (format === value || (value === "1QB" && format === "1QB_TEP") || (value === "SUPERFLEX" && format === "SUPERFLEX_TEP"))
                      ? "bg-accent text-white" : "text-ink-secondary hover:text-ink"
                  )}
                  aria-pressed={format === value || (value === "1QB" && format === "1QB_TEP") || (value === "SUPERFLEX" && format === "SUPERFLEX_TEP")}
                >
                  {value === "1QB" ? "1 QB" : "Superflex"}
                </button>
              ))}
            </div>

          <div className="inline-flex h-9 border border-border-strong bg-surface p-0.5">
            <button
              type="button"
              onClick={() => {
                const checked = !(format === "1QB_TEP" || format === "SUPERFLEX_TEP");
                const isSF = format === "SUPERFLEX" || format === "SUPERFLEX_TEP";
                const nextFormat: LeagueFormat = checked
                  ? (isSF ? "SUPERFLEX_TEP" : "1QB_TEP")
                  : (isSF ? "SUPERFLEX" : "1QB");
                applyFormat(nextFormat);
              }}
              aria-pressed={format === "1QB_TEP" || format === "SUPERFLEX_TEP"}
              className={cn(
                "h-full whitespace-nowrap px-3 font-mono text-[10px] font-semibold uppercase tracking-widest2 transition-colors duration-150",
                format === "1QB_TEP" || format === "SUPERFLEX_TEP"
                  ? "bg-accent text-white"
                  : "text-ink-secondary hover:text-ink"
              )}
            >
              TEP
            </button>
          </div>


          <FilterSelect
            label="Filter by position"
            value={position}
            onChange={(e) => handlePositionChange(e.target.value as Position | "all")}
          >
            <option value="all">All Positions</option>
            {ALL_POSITIONS.map((pos) => (
              <option key={pos} value={pos}>
                {pos}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect
            label="Filter by tier"
            value={tier}
            onChange={(e) => handleTierChange(e.target.value as Tier | "all")}
          >
            <option value="all">All Tiers</option>
            {ALL_TIERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </FilterSelect>

          {filtersActive && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 border border-border px-3 py-2.5 text-sm text-ink-secondary transition-colors duration-150 hover:border-accent/50 hover:text-accent"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* RESULT COUNT */}
      <p className="mt-4 font-mono text-xs text-ink-tertiary">
        {sorted.length === 0
          ? "0 results"
          : `Showing ${rangeStart}–${rangeEnd} of ${sorted.length}`}
      </p>

      {/* TABLE — sm and up. Below that, a card list replaces this
          entirely instead of forcing horizontal scroll to see Score/
          Tier, which is what this table did on mobile before. */}
      <div className="mt-3 hidden overflow-x-auto border border-border sm:block">
        <table className="w-full min-w-0 border-collapse text-sm sm:min-w-[700px]">
          <thead>
            <tr className="bg-surface-raised">
              <th scope="col" className="w-8 px-1.5 sm:px-2">
                <span className="sr-only">Watchlist</span>
              </th>
              <SortTh
                label="Rank"
                active={sortKey === "rank"}
                dir={sortDir}
                onClick={() => handleSort("rank")}
                className="w-9 px-1.5 text-left sm:w-16 sm:px-4"
              />
              <SortTh
                label="Player"
                active={sortKey === "name"}
                dir={sortDir}
                onClick={() => handleSort("name")}
                className="min-w-[96px] px-1.5 text-left sm:min-w-[200px] sm:px-4"
              />
              <SortTh
                label="Pos"
                active={sortKey === "position"}
                dir={sortDir}
                onClick={() => handleSort("position")}
                className="px-1.5 text-left sm:px-4"
              />
              <SortTh
                label="School"
                active={sortKey === "school"}
                dir={sortDir}
                onClick={() => handleSort("school")}
                className="hidden px-2 text-left sm:table-cell sm:px-4"
              />
              {showClassColumn && (
                <SortTh
                  label="Class"
                  active={sortKey === "draftClass"}
                  dir={sortDir}
                  onClick={() => handleSort("draftClass")}
                  className="hidden px-1.5 text-left sm:table-cell sm:px-4"
                />
              )}
              <SortTh
                label={scoreColumnLabel}
                active={sortKey === "preDraftScore"}
                dir={sortDir}
                onClick={() => handleSort("preDraftScore")}
                className="px-1.5 text-right sm:px-4"
              />
              <SortTh
                label="DD Score"
                active={sortKey === "score"}
                dir={sortDir}
                onClick={() => handleSort("score")}
                className="px-1.5 text-right sm:px-4"
              />
              <SortTh
                label="Tier"
                active={sortKey === "tier"}
                dir={sortDir}
                onClick={() => handleSort("tier")}
                className="px-1.5 text-left sm:px-4"
              />
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <Inbox className="h-6 w-6 text-ink-tertiary" strokeWidth={1.5} />
                    {filtersActive ? (
                      <>
                        <p className="text-sm font-medium text-ink-secondary">
                          No prospects match your filters.
                        </p>
                        <button
                          onClick={clearFilters}
                          className="font-mono text-xs uppercase tracking-widest2 text-accent hover:underline"
                        >
                          Clear filters
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-ink-secondary">
                          Rankings haven&apos;t been published yet.
                        </p>
                        <p className="max-w-xs text-xs leading-relaxed text-ink-tertiary">
                          Grading is still in progress. Check back once the
                          model goes live.
                        </p>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              pageItems.map((p, idx) => {
                const globalIndex = (safePage - 1) * PAGE_SIZE + idx; // 0-based
                // The player's own fixed rank — never the row's position
                // within whatever's currently filtered/searched/paginated
                // into view, so searching for one player never relabels
                // them as "#1". globalIndex is only a last-resort fallback
                // for the rare prospect with no rank data at all.
                const pick = collectionRankMap?.get(p.id) ?? getRankForFormat(p, format) ?? globalIndex + 1;
                const round = Math.ceil(pick / 12);
                const isRoundBoundary =
                  showBigBoardDividers && position === "all" && tier === "all" && pick > 1 && (pick - 1) % 12 === 0;
                // Only 4 real rounds exist. The boundary where round 5
                // would start becomes a single "Waiver Wire" marker
                // instead, and no further round lines appear after it.
                const isRoundStart = isRoundBoundary && round <= 4;
                const isWaiverWireStart = isRoundBoundary && round === 5;

                const prevP = idx > 0 ? pageItems[idx - 1] : null;
                const currentTier = getDDTier(p, format);
                const prevTier = prevP ? getDDTier(prevP, format) : currentTier;
                const isTierChange =
                  showBigBoardDividers &&
                  sortKey === "rank" &&
                  !isRoundStart &&
                  !isWaiverWireStart &&
                  currentTier !== prevTier &&
                  idx > 0;

                return (
                  <Fragment key={p.id}>
                    {isRoundStart && (
                      <tr>
                        <td colSpan={columnCount} className="border-t-2 border-accent/60 bg-accent/5 px-4 py-1.5">
                          <span className="font-mono text-[11px] font-semibold uppercase tracking-widest2 text-accent">
                            Round {round} · Pick {pick}
                          </span>
                        </td>
                      </tr>
                    )}
                    {isWaiverWireStart && (
                      <tr>
                        <td colSpan={columnCount} className="border-t-2 border-accent/60 bg-accent/5 px-4 py-1.5">
                          <span className="font-mono text-[11px] font-semibold uppercase tracking-widest2 text-accent">
                            Waiver Wire
                          </span>
                        </td>
                      </tr>
                    )}
                    {isTierChange && (
                      <tr>
                        <td
                          colSpan={columnCount}
                          className="border-t-2 px-0 py-0"
                          style={{ borderColor: currentTier ? getTierColor(currentTier) : undefined }}
                        />
                      </tr>
                    )}
                    <tr
                      className="group border-t border-border transition-colors duration-150 hover:bg-surface-raised"
                    >
                      <td
                        className="w-8 border-l-[3px] px-1.5 py-4 sm:px-2"
                        style={{ borderLeftColor: currentTier ? getTierColor(currentTier) : "transparent" }}
                      >
                        <WatchlistButton prospectId={p.id} />
                      </td>
                      <td className="w-9 px-1.5 py-4 font-mono text-ink-tertiary sm:w-16 sm:px-4">{pick}</td>
                      <td className="min-w-[96px] px-1.5 py-4 font-semibold text-ink sm:min-w-[200px] sm:px-4">
                        <Link
                          href={playerHref(p.id, format)}
                          prefetch={false}
                          className="hover:text-accent hover:underline"
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td className="px-1.5 py-4 sm:px-4">
                        <Badge tone="neutral">{p.position}</Badge>
                      </td>
                      <td className="hidden px-2 py-4 text-ink-secondary sm:table-cell sm:px-4">
                        <span className="flex items-center gap-1.5">
                          <SchoolLogo url={p.schoolLogoUrl} size={16} />
                          {p.school ?? "—"}
                        </span>
                      </td>
                      {showClassColumn && (
                        <td className="hidden px-1.5 py-4 font-mono text-ink-secondary sm:table-cell sm:px-4">
                          {p.draftClass ? (
                            <Link href={`/classes/${p.draftClass}`} prefetch={false} className="hover:text-accent hover:underline">
                              {p.draftClass}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                      )}
                      <td className="px-1.5 py-4 text-right font-mono text-ink-secondary sm:px-4">
                        {getDisplayedPreDraftScore(p)?.toFixed(1) ?? "—"}
                      </td>
                      <td className="px-1.5 py-4 text-right sm:px-4">
                        <span
                          className="font-mono text-base font-bold tabular-nums sm:text-lg"
                          style={{ color: currentTier ? getTierColor(currentTier) : undefined }}
                        >
                          {getDDScore(p, format)?.toFixed(1) ?? (getDisplayedPreDraftScore(p) !== undefined ? "TBD" : "—")}
                        </span>
                      </td>
                      <td className="px-1.5 py-4 sm:px-4">{currentTier ? <TierBadge tier={currentTier} perfectScore={getDDScore(p, format) === 100} /> : "—"}</td>
                    </tr>
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MOBILE CARD LIST — below sm, replaces the table above entirely. */}
      <div className="mt-3 sm:hidden">
        {pageItems.length === 0 ? (
          <div className="border border-border px-6 py-16 text-center">
            <div className="flex flex-col items-center gap-3">
              <Inbox className="h-6 w-6 text-ink-tertiary" strokeWidth={1.5} />
              {filtersActive ? (
                <>
                  <p className="text-sm font-medium text-ink-secondary">
                    No prospects match your filters.
                  </p>
                  <button
                    onClick={clearFilters}
                    className="font-mono text-xs uppercase tracking-widest2 text-accent hover:underline"
                  >
                    Clear filters
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-ink-secondary">
                    Rankings haven&apos;t been published yet.
                  </p>
                  <p className="max-w-xs text-xs leading-relaxed text-ink-tertiary">
                    Grading is still in progress. Check back once the model goes live.
                  </p>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="border border-border">
            {pageItems.map((p, idx) => {
              const globalIndex = (safePage - 1) * PAGE_SIZE + idx;
              const pick = collectionRankMap?.get(p.id) ?? getRankForFormat(p, format) ?? globalIndex + 1;
              const round = Math.ceil(pick / 12);
              const isRoundBoundary =
                showBigBoardDividers && position === "all" && tier === "all" && pick > 1 && (pick - 1) % 12 === 0;
              const isRoundStart = isRoundBoundary && round <= 4;
              const isWaiverWireStart = isRoundBoundary && round === 5;

              const prevP = idx > 0 ? pageItems[idx - 1] : null;
              const currentTier = getDDTier(p, format);
              const prevTier = prevP ? getDDTier(prevP, format) : currentTier;
              const isTierChange =
                showBigBoardDividers &&
                sortKey === "rank" &&
                !isRoundStart &&
                !isWaiverWireStart &&
                currentTier !== prevTier &&
                idx > 0;

              return (
                <Fragment key={p.id}>
                  {isRoundStart && (
                    <div className="border-t-2 border-accent/60 bg-accent/5 px-3 py-1.5">
                      <span className="font-mono text-[10px] font-semibold uppercase tracking-widest2 text-accent">
                        Round {round} · Pick {pick}
                      </span>
                    </div>
                  )}
                  {isWaiverWireStart && (
                    <div className="border-t-2 border-accent/60 bg-accent/5 px-3 py-1.5">
                      <span className="font-mono text-[10px] font-semibold uppercase tracking-widest2 text-accent">
                        Waiver Wire
                      </span>
                    </div>
                  )}
                  {isTierChange && (
                    <div
                      className="border-t-2"
                      style={{ borderColor: currentTier ? getTierColor(currentTier) : undefined }}
                    />
                  )}
                  <div
                    className="flex items-center gap-3 border-t border-l-[3px] border-border px-3 py-3 first:border-t-0"
                    style={{ borderLeftColor: currentTier ? getTierColor(currentTier) : "transparent" }}
                  >
                    <span className="w-7 shrink-0 text-center font-mono text-xs text-ink-tertiary">{pick}</span>
                    <WatchlistButton prospectId={p.id} className="shrink-0" />
                    <Link href={playerHref(p.id, format)} prefetch={false} className="min-w-0 flex-1 active:opacity-60">
                      <p className="truncate text-sm font-semibold text-ink hover:text-accent hover:underline">
                        {p.name}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-ink-tertiary">
                        <span className="font-medium text-ink-secondary">{p.position}</span>
                        {p.school && (
                          <>
                            · <SchoolLogo url={p.schoolLogoUrl} size={12} /> {p.school}
                          </>
                        )}
                        {showClassColumn && p.draftClass && <> · {p.draftClass}</>}
                      </p>
                    </Link>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span
                        className="font-mono text-base font-bold tabular-nums"
                        style={{ color: currentTier ? getTierColor(currentTier) : undefined }}
                      >
                        {/* Devy/undrafted prospects show their real
                            Pre-Draft Score here — the desktop table
                            has a separate column for this, but the
                            condensed mobile card only has room for
                            one number, so it needs to actually be a
                            number rather than falling back to "TBD"
                            with no score visible anywhere on mobile. */}
                        {getDDScore(p, format)?.toFixed(1) ?? getDisplayedPreDraftScore(p)?.toFixed(1) ?? "—"}
                      </span>
                      {currentTier ? (
                        <TierBadge tier={currentTier} perfectScore={getDDScore(p, format) === 100} />
                      ) : (
                        <span className="text-xs text-ink-tertiary">—</span>
                      )}
                    </div>
                  </div>
                </Fragment>
              );
            })}
          </div>
        )}
      </div>

      {/* PAGINATION */}
      <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <p className="font-mono text-xs text-ink-tertiary">
          Page {safePage} of {totalPages}
        </p>
        <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </div>
  );
}

function SortTh({
  label,
  active,
  dir,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  className?: string;
}) {
  return (
    <th
      scope="col"
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn("border-b-2 border-border-strong px-4 py-3", className)}
    >
      <button
        onClick={onClick}
        className={cn(
          "flex items-center gap-1.5 p-1.5 -m-1.5 font-mono text-[11px] font-medium uppercase tracking-widest2 transition-colors duration-150",
          className?.includes("text-right") && "ml-auto",
          active ? "text-accent" : "text-ink-tertiary hover:text-ink"
        )}
      >
        {label}
        {active ? (
          dir === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </th>
  );
}

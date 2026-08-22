"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  X,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TierBadge } from "@/components/rankings/TierBadge";
import { SchoolLogo } from "@/components/ui/SchoolLogo";
import { FilterSelect } from "@/components/rankings/FilterSelect";
import { Pagination } from "@/components/rankings/Pagination";
import { ALL_TIERS, getDisplayedPreDraftScore } from "@/lib/prospects";
import { getDDScore, getDDTier, buildRanksWithinCollection, type LeagueFormat } from "@/lib/ddScore";
import { getTierColor } from "@/lib/tiers";
import { WatchlistButton } from "@/components/watchlist/WatchlistButton";
import type { Tier, Prospect } from "@/types/prospect";
import type { PositionTheme } from "@/lib/positionThemes";

type SortKey = "rank" | "name" | "school" | "preDraftScore" | "score" | "tier" | "draftClass";

const DEFAULT_DIR: Record<SortKey, "asc" | "desc"> = {
  rank: "asc",
  name: "asc",
  school: "asc",
  preDraftScore: "desc",
  score: "desc",
  tier: "asc",
  draftClass: "asc",
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

/**
 * Small inline "▲ +2.3" / "▼ −1.1" indicator next to a player's
 * score — see lib/trending.ts for what this is comparing against.
 * Renders nothing when there's no tracked change, which is the
 * common case (most players' scores don't move between updates).
 */
function DeltaIndicator({ delta }: { delta: number | undefined }) {
  if (delta === undefined) return null;
  const positive = delta > 0;
  return (
    <span className={cn("ml-1.5 font-mono text-[10px] font-semibold", positive ? "text-riser" : "text-faller")}>
      {positive ? "▲" : "▼"} {positive ? "+" : ""}
      {delta.toFixed(1)}
    </span>
  );
}

function sortValue(p: Prospect, key: SortKey, format: LeagueFormat, rankMap: Map<string, number> | null): string | number {
  switch (key) {
    case "rank":
      return rankMap?.get(p.id) ?? Number.POSITIVE_INFINITY;
    case "name":
      return p.name.toLowerCase();
    case "school":
      return (p.school ?? "").toLowerCase();
    case "preDraftScore":
      return getDisplayedPreDraftScore(p) ?? -1;
    case "score":
      return getDDScore(p, format) ?? -1;
    case "tier": {
      const t = getDDTier(p, format);
      return t ? TIER_ORDER[t] : 99;
    }
    case "draftClass":
      return p.draftClass ?? "";
  }
}

export function PositionExplorer({
  prospects,
  theme,
  qbFormat,
  tep,
  onQbFormatChange,
  onTepToggle,
  scoreDeltas,
}: {
  prospects: Prospect[];
  theme: PositionTheme;
  /** Format is controlled by the parent (PositionRankingsWithChart) so
   *  the hit-rate chart above this table can share the exact same
   *  1QB/Superflex + TEP state instead of drifting independently. */
  qbFormat: "1QB" | "SUPERFLEX";
  tep: boolean;
  onQbFormatChange: (value: "1QB" | "SUPERFLEX") => void;
  onTepToggle: () => void;
  scoreDeltas: Record<string, number>;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlQuery = searchParams.get("q") ?? "";
  const urlDraftClass = searchParams.get("draftClass") ?? "all";
  const urlTier = searchParams.get("tier");
  const urlPage = searchParams.get("page");
  const urlSort = searchParams.get("sort") as SortKey | null;
  const urlDir = searchParams.get("dir");
  const validSortKeys: SortKey[] = ["rank", "name", "school", "preDraftScore", "score", "tier", "draftClass"];
  const initialSortKey: SortKey = urlSort && validSortKeys.includes(urlSort) ? urlSort : "rank";
  const initialSortDir: "asc" | "desc" = urlDir === "desc" ? "desc" : DEFAULT_DIR[initialSortKey];

  const format: LeagueFormat = tep
    ? (qbFormat === "SUPERFLEX" ? "SUPERFLEX_TEP" : "1QB_TEP")
    : qbFormat;

  const [query, setQuery] = useState(urlQuery);
  const [draftClass, setDraftClass] = useState<string>(urlDraftClass);

  const [tier, setTier] = useState<Tier | "all">(urlTier && ALL_TIERS.includes(urlTier as Tier) ? (urlTier as Tier) : "all");
  const [sortKey, setSortKey] = useState<SortKey>(initialSortKey);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(initialSortDir);
  const [page, setPage] = useState(() => {
    const n = urlPage ? Number(urlPage) : 1;
    return Number.isFinite(n) && n > 0 ? n : 1;
  });

  const draftClassOptions = useMemo(() => {
    const years = new Set<string>();
    prospects.forEach((p) => p.draftClass && years.add(p.draftClass));
    return [...years].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  }, [prospects]);

  const filtersActive = query.trim() !== "" || draftClass !== "all" || tier !== "all";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return prospects.filter((p) => {
      const school = (p.school ?? "").toLowerCase();
      if (q && !p.name.toLowerCase().includes(q) && !school.includes(q))
        return false;
      if (draftClass !== "all" && p.draftClass !== draftClass) return false;
      if (tier !== "all" && getDDTier(p, format) !== tier) return false;
      return true;
    });
  }, [prospects, query, draftClass, tier, format]);

  // Label the column from the actual sheet state: if every displayed
  // prospect is missing either real ADP or OPP, the value is a Pre-Draft
  // Score. Completed/resolved rows use POS Score.
  const isPreDraftView = filtered.length > 0 && filtered.every((p) => !p.hasDraftData);
  const scoreColumnLabel = isPreDraftView ? "Pre-Draft Score" : "POS Score";

  // Rank within just this position's own prospect pool (1, 2, 3...),
  // matching how draft-class pages rank within that class rather than
  // showing the site-wide overall rank — see RankingsTable's identical
  // rankScope="collection" pattern.
  const collectionRankMap = useMemo(() => buildRanksWithinCollection(prospects, format), [prospects, format]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = sortValue(a, sortKey, format, collectionRankMap);
      const bv = sortValue(b, sortKey, format, collectionRankMap);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDir, format, collectionRankMap]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function replaceListingParams(update: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    update(params);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function resetPageParam(params: URLSearchParams) {
    params.delete("page");
  }

  function setListingPage(newPage: number) {
    setPage(newPage);
    replaceListingParams((params) => {
      if (newPage <= 1) params.delete("page");
      else params.set("page", String(newPage));
    });
  }

  function handleSort(key: SortKey) {
    const nextDir = key === sortKey ? (sortDir === "asc" ? "desc" : "asc") : DEFAULT_DIR[key];
    setSortKey(key);
    setSortDir(nextDir);
    setPage(1);
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
    setPage(1);
    replaceListingParams((params) => {
      if (value.trim()) params.set("q", value);
      else params.delete("q");
      resetPageParam(params);
    });
  }

  function handleDraftClassChange(value: string) {
    setDraftClass(value);
    setPage(1);
    replaceListingParams((params) => {
      if (value === "all") params.delete("draftClass");
      else params.set("draftClass", value);
      resetPageParam(params);
    });
  }

  function handleTierChange(value: Tier | "all") {
    setTier(value);
    setPage(1);
    replaceListingParams((params) => {
      if (value === "all") params.delete("tier");
      else params.set("tier", value);
      resetPageParam(params);
    });
  }

  function clearFilters() {
    setQuery("");
    setDraftClass("all");
    setTier("all");
    setPage(1);
    replaceListingParams((params) => {
      params.delete("q");
      params.delete("draftClass");
      params.delete("tier");
      resetPageParam(params);
    });
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
            placeholder={`Search ${theme.label.toLowerCase()} or school`}
            aria-label={`Search ${theme.label.toLowerCase()} or school`}
            className="w-full border border-border-strong bg-surface py-2.5 pl-9 pr-3 text-base text-ink placeholder:text-ink-tertiary transition-colors duration-150 focus:outline-none"
            onFocus={(e) => (e.currentTarget.style.borderColor = theme.accent)}
            onBlur={(e) => (e.currentTarget.style.borderColor = "")}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex h-9 border border-border-strong bg-surface p-0.5" role="group" aria-label="Quarterback format">
              {(["1QB", "SUPERFLEX"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    onQbFormatChange(value);
                    setPage(1);
                    replaceListingParams((params) => { params.delete("page"); });
                  }}
                  className={cn(
                    "h-full whitespace-nowrap px-2.5 font-mono text-[10px] font-semibold uppercase tracking-widest2 transition-colors sm:px-3 sm:text-[11px]",
                    qbFormat === value ? "bg-accent text-white" : "text-ink-secondary hover:text-ink"
                  )}
                  aria-pressed={qbFormat === value}
                >
                  {value === "1QB" ? "1 QB" : "Superflex"}
                </button>
              ))}
            </div>

          <div className="inline-flex h-9 border border-border-strong bg-surface p-0.5">
            <button
              type="button"
              onClick={() => {
                onTepToggle();
                setPage(1);
                replaceListingParams((params) => { params.delete("page"); });
              }}
              aria-pressed={tep}
              className={cn(
                "h-full whitespace-nowrap px-3 font-mono text-[10px] font-semibold uppercase tracking-widest2 transition-colors duration-150",
                tep ? "bg-accent text-white" : "text-ink-secondary hover:text-ink"
              )}
            >
              TEP
            </button>
          </div>


          <FilterSelect
            label="Filter by draft class"
            value={draftClass}
            onChange={(e) => setDraftClass(e.target.value)}
          >
            <option value="all">All Classes</option>
            {draftClassOptions.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect
            label="Filter by tier"
            value={tier}
            onChange={(e) => setTier(e.target.value as Tier | "all")}
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
              className="flex items-center gap-1.5 border border-border px-3 py-2.5 text-sm text-ink-secondary transition-colors duration-150 hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          )}

        </div>
      </div>

      <p className="mt-4 font-mono text-xs text-ink-tertiary">
        {sorted.length === 0 ? "0 results" : `${sorted.length} prospects`}
      </p>

      {/* EMPTY STATE */}
      {pageItems.length === 0 && (
        <div className="mt-3 flex flex-col items-center gap-3 border border-border bg-surface py-16 text-center">
          <Inbox className="h-6 w-6 text-ink-tertiary" strokeWidth={1.5} />
          {filtersActive ? (
            <>
              <p className="text-sm font-medium text-ink-secondary">
                No prospects match your filters.
              </p>
              <button
                onClick={clearFilters}
                className="font-mono text-xs uppercase tracking-widest2 hover:underline"
                style={{ color: theme.accent }}
              >
                Clear filters
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-ink-secondary">
                No {theme.label.toLowerCase()} have been graded yet.
              </p>
              <p className="max-w-xs text-xs leading-relaxed text-ink-tertiary">
                Check back once the model goes live.
              </p>
            </>
          )}
        </div>
      )}

      {/* TABLE VIEW — sm and up. See RankingsTable.tsx for the same
          pattern; below sm, a card list replaces this instead of
          forcing horizontal scroll. */}
      {pageItems.length > 0 && (
        <div className="mt-3 hidden overflow-x-auto border border-border sm:block">
          <table className="w-full min-w-0 border-collapse text-sm sm:min-w-[720px]">
            <thead>
              <tr className="bg-surface-raised">
                <th scope="col" className="w-8 px-1.5 sm:px-2">
                  <span className="sr-only">Watchlist</span>
                </th>
                <SortTh label="Rank" sortKeyName="rank" sortKey={sortKey} sortDir={sortDir} handleSort={handleSort} theme={theme} className="w-9 px-1.5 text-left sm:w-16 sm:px-4" />
                <SortTh label="Player" sortKeyName="name" sortKey={sortKey} sortDir={sortDir} handleSort={handleSort} theme={theme} className="min-w-[96px] px-1.5 text-left sm:min-w-[200px] sm:px-4" />
                <SortTh label="School" sortKeyName="school" sortKey={sortKey} sortDir={sortDir} handleSort={handleSort} theme={theme} className="hidden px-2 text-left sm:table-cell sm:px-4" />
                <SortTh label={scoreColumnLabel} sortKeyName="preDraftScore" sortKey={sortKey} sortDir={sortDir} handleSort={handleSort} theme={theme} className="px-1.5 text-right sm:px-4" />
                <SortTh label="DD Score" sortKeyName="score" sortKey={sortKey} sortDir={sortDir} handleSort={handleSort} theme={theme} className="px-1.5 text-right sm:px-4" />
                <SortTh label="Tier" sortKeyName="tier" sortKey={sortKey} sortDir={sortDir} handleSort={handleSort} theme={theme} className="px-1.5 text-left sm:px-4" />
              </tr>
            </thead>
            <tbody>
              {pageItems.map((p) => {
                const currentTier = getDDTier(p, format);
                return (
                <tr key={p.id} className="border-t border-border transition-colors duration-150 hover:bg-surface-raised">
                  <td className="w-8 px-1.5 py-4 sm:px-2">
                    <WatchlistButton prospectId={p.id} />
                  </td>
                  <td className="px-1.5 py-4 font-mono text-ink-tertiary sm:px-4">{collectionRankMap.get(p.id) ?? "—"}</td>
                  <td className="min-w-0 px-1.5 py-4 font-medium text-ink sm:px-4">
                    <Link
                      href={`/players/${p.id}`}
                      prefetch={false}
                      className="break-words hover:underline"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="hidden px-2 py-4 text-ink-secondary sm:table-cell sm:px-4">
                    <span className="flex items-center gap-1.5">
                      <SchoolLogo url={p.schoolLogoUrl} size={16} />
                      {p.school ?? "—"}
                    </span>
                  </td>
                  <td className="px-1.5 py-4 text-right font-mono text-ink-secondary sm:px-4">
                    {getDisplayedPreDraftScore(p)?.toFixed(1) ?? "—"}
                    <DeltaIndicator delta={scoreDeltas[p.id]} />
                  </td>
                  <td className="px-1.5 py-4 text-right font-mono font-semibold sm:px-4" style={{ color: currentTier ? getTierColor(currentTier) : undefined }}>
                    {getDDScore(p, format)?.toFixed(1) ?? (p.preDraftScore !== undefined ? "TBD" : "—")}
                  </td>
                  <td className="whitespace-nowrap px-1.5 py-4 sm:px-4">
                    {getDDTier(p, format) ? (
                      <TierBadge
                        tier={getDDTier(p, format)!}
                        perfectScore={getDDScore(p, format) === 100}
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MOBILE CARD LIST — below sm, replaces the table above entirely. */}
      {pageItems.length > 0 && (
        <div className="mt-3 border border-border sm:hidden">
          {pageItems.map((p) => {
            const currentTier = getDDTier(p, format);
            return (
              <Link
                key={p.id}
                href={`/players/${p.id}`}
                prefetch={false}
                className="flex items-center gap-3 border-t border-border px-3 py-3 transition-colors duration-100 first:border-t-0 active:bg-surface-raised"
              >
                <span className="w-7 shrink-0 text-center font-mono text-xs text-ink-tertiary">
                  {collectionRankMap.get(p.id) ?? "—"}
                </span>
                <WatchlistButton prospectId={p.id} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink hover:text-accent hover:underline">
                    {p.name}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-ink-tertiary">
                    <SchoolLogo url={p.schoolLogoUrl} size={12} /> {p.school ?? "—"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className="font-mono text-base font-bold tabular-nums"
                    style={{ color: currentTier ? getTierColor(currentTier) : undefined }}
                  >
                    {/* See RankingsTable.tsx's mobile card for why
                        this falls back to the real Pre-Draft Score
                        instead of "TBD" — the desktop table has a
                        separate column for it, mobile doesn't. */}
                    {getDDScore(p, format)?.toFixed(1) ?? getDisplayedPreDraftScore(p)?.toFixed(1) ?? "—"}
                  </span>
                  <DeltaIndicator delta={scoreDeltas[p.id]} />
                  {currentTier ? (
                    <TierBadge tier={currentTier} perfectScore={getDDScore(p, format) === 100} />
                  ) : (
                    <span className="text-xs text-ink-tertiary">—</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* PAGINATION */}
      <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <p className="font-mono text-xs text-ink-tertiary">
          Page {safePage} of {totalPages}
        </p>
        <Pagination page={safePage} totalPages={totalPages} onPageChange={setListingPage} />
      </div>
    </div>
  );
}

function SortTh({
  label,
  sortKeyName,
  sortKey,
  sortDir,
  handleSort,
  theme,
  className,
}: {
  label: string;
  sortKeyName: SortKey;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  handleSort: (key: SortKey) => void;
  theme: PositionTheme;
  className?: string;
}) {
  const active = sortKey === sortKeyName;
  return (
    <th
      scope="col"
      aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
      className={cn("border-b-2 border-border-strong px-4 py-3", className)}
    >
      <button
        onClick={() => handleSort(sortKeyName)}
        className={cn(
          "flex items-center gap-1.5 p-1.5 -m-1.5 font-mono text-[11px] font-medium uppercase tracking-widest2 transition-colors duration-150 text-ink-tertiary hover:text-ink",
          className?.includes("text-right") && "ml-auto"
        )}
        style={{ color: active ? theme.accent : undefined }}
      >
        {label}
        {active ? (
          sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </th>
  );
}

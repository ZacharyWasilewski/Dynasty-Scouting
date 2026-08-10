"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  X,
  Inbox,
  LayoutGrid,
  List,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TierBadge } from "@/components/rankings/TierBadge";
import { FilterSelect } from "@/components/rankings/FilterSelect";
import { Pagination } from "@/components/rankings/Pagination";
import { PlayerCard } from "@/components/positions/PlayerCard";
import { ALL_TIERS } from "@/lib/prospects";
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

function sortValue(p: Prospect, key: SortKey): string | number {
  switch (key) {
    case "rank":
      return p.rank ?? Number.POSITIVE_INFINITY;
    case "name":
      return p.name.toLowerCase();
    case "school":
      return (p.school ?? "").toLowerCase();
    case "preDraftScore":
      return p.preDraftScore ?? -1;
    case "score":
      return p.grade?.overall ?? -1;
    case "tier":
      return p.tier ? TIER_ORDER[p.tier] : 99;
    case "draftClass":
      return p.draftClass ?? "";
  }
}

export function PositionExplorer({
  prospects,
  theme,
}: {
  prospects: Prospect[];
  theme: PositionTheme;
}) {
  const [query, setQuery] = useState("");
  const [draftClass, setDraftClass] = useState<string>("all");
  const [tier, setTier] = useState<Tier | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [view, setView] = useState<"table" | "grid">("table");
  const [page, setPage] = useState(1);

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
      if (tier !== "all" && p.tier !== tier) return false;
      return true;
    });
  }, [prospects, query, draftClass, tier]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [query, draftClass, tier, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(DEFAULT_DIR[key]);
    }
  }

  function clearFilters() {
    setQuery("");
    setDraftClass("all");
    setTier("all");
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
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${theme.label.toLowerCase()} or school`}
            aria-label={`Search ${theme.label.toLowerCase()} or school`}
            className="w-full border border-border-strong bg-surface py-2.5 pl-9 pr-3 text-sm text-ink placeholder:text-ink-tertiary transition-colors duration-150 focus:outline-none"
            onFocus={(e) => (e.currentTarget.style.borderColor = theme.accent)}
            onBlur={(e) => (e.currentTarget.style.borderColor = "")}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
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

          <div className="flex border border-border">
            <button
              aria-label="Table view"
              aria-pressed={view === "table"}
              onClick={() => setView("table")}
              className={cn(
                "flex h-[42px] w-10 items-center justify-center transition-colors duration-150",
                view === "table" ? "text-void" : "text-ink-tertiary hover:text-ink"
              )}
              style={{ backgroundColor: view === "table" ? theme.accent : "transparent" }}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              aria-label="Card view"
              aria-pressed={view === "grid"}
              onClick={() => setView("grid")}
              className={cn(
                "flex h-[42px] w-10 items-center justify-center border-l border-border transition-colors duration-150",
                view === "grid" ? "text-void" : "text-ink-tertiary hover:text-ink"
              )}
              style={{ backgroundColor: view === "grid" ? theme.accent : "transparent" }}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
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

      {/* TABLE VIEW */}
      {pageItems.length > 0 && view === "table" && (
        <div className="mt-3 overflow-x-auto border border-border">
          <table className="w-full min-w-0 border-collapse text-sm sm:min-w-[720px]">
            <thead>
              <tr className="bg-surface-raised">
                <SortTh label="Rank" sortKeyName="rank" sortKey={sortKey} sortDir={sortDir} handleSort={handleSort} theme={theme} className="w-9 px-1.5 text-left sm:w-16 sm:px-4" />
                <SortTh label="Player" sortKeyName="name" sortKey={sortKey} sortDir={sortDir} handleSort={handleSort} theme={theme} className="min-w-[96px] px-1.5 text-left sm:min-w-[200px] sm:px-4" />
                <SortTh label="School" sortKeyName="school" sortKey={sortKey} sortDir={sortDir} handleSort={handleSort} theme={theme} className="hidden px-2 text-left sm:table-cell sm:px-4" />
                <SortTh label="Pre-Draft" sortKeyName="preDraftScore" sortKey={sortKey} sortDir={sortDir} handleSort={handleSort} theme={theme} className="px-1.5 text-right sm:px-4" />
                <SortTh label="Score" sortKeyName="score" sortKey={sortKey} sortDir={sortDir} handleSort={handleSort} theme={theme} className="px-1.5 text-right sm:px-4" />
                <SortTh label="Tier" sortKeyName="tier" sortKey={sortKey} sortDir={sortDir} handleSort={handleSort} theme={theme} className="px-1.5 text-left sm:px-4" />
              </tr>
            </thead>
            <tbody>
              {pageItems.map((p) => (
                <tr key={p.id} className="border-t border-border transition-colors duration-150 hover:bg-surface-raised">
                  <td className="px-1.5 py-4 font-mono text-ink-tertiary sm:px-4">{p.rank ?? "—"}</td>
                  <td className="px-1.5 py-4 font-medium text-ink sm:px-4">
                    <Link href={`/players/${p.id}`} className="hover:underline">
                      {p.name}
                    </Link>
                  </td>
                  <td className="hidden px-2 py-4 text-ink-secondary sm:table-cell sm:px-4">{p.school ?? "—"}</td>
                  <td className="px-1.5 py-4 text-right font-mono text-ink-secondary sm:px-4">
                    {p.preDraftScore?.toFixed(1) ?? "—"}
                  </td>
                  <td className="px-1.5 py-4 text-right font-mono font-semibold text-ink sm:px-4">
                    {p.grade?.overall?.toFixed(1) ?? (p.preDraftScore !== undefined ? "TBD" : "—")}
                  </td>
                  <td className="px-1.5 py-4 sm:px-4">{p.tier ? <TierBadge tier={p.tier} /> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* GRID VIEW */}
      {pageItems.length > 0 && view === "grid" && (
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pageItems.map((p) => (
            <PlayerCard key={p.id} prospect={p} theme={theme} />
          ))}
        </div>
      )}

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
          "flex items-center gap-1.5 font-mono text-[11px] font-medium uppercase tracking-widest2 transition-colors duration-150 text-ink-tertiary hover:text-ink",
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

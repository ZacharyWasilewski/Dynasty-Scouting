"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
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
import { FilterSelect } from "@/components/rankings/FilterSelect";
import { Pagination } from "@/components/rankings/Pagination";
import { ALL_POSITIONS, ALL_TIERS } from "@/lib/prospects";
import type { Position, Tier, Prospect } from "@/types/prospect";

type SortKey =
  | "rank"
  | "name"
  | "position"
  | "school"
  | "preDraftScore"
  | "score"
  | "tier"
  | "draftClass";

const DEFAULT_DIR: Record<SortKey, "asc" | "desc"> = {
  rank: "asc",
  name: "asc",
  position: "asc",
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
    case "position":
      return p.position;
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

export function RankingsTable({ prospects }: { prospects: Prospect[] }) {
  return (
    <Suspense fallback={null}>
      <RankingsTableInner prospects={prospects} />
    </Suspense>
  );
}

function RankingsTableInner({ prospects }: { prospects: Prospect[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const urlPosition = searchParams.get("position");
  const urlTier = searchParams.get("tier");
  const urlPage = searchParams.get("page");

  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<Position | "all">(
    urlPosition && ALL_POSITIONS.includes(urlPosition as Position)
      ? (urlPosition as Position)
      : "all"
  );
  const [draftClass, setDraftClass] = useState<string>("all");
  const [tier, setTier] = useState<Tier | "all">(
    urlTier && ALL_TIERS.includes(urlTier as Tier) ? (urlTier as Tier) : "all"
  );
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPageState] = useState(() => {
    const n = urlPage ? Number(urlPage) : 1;
    return Number.isFinite(n) && n > 0 ? n : 1;
  });

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

  const draftClassOptions = useMemo(() => {
    const years = new Set<string>();
    prospects.forEach((p) => p.draftClass && years.add(p.draftClass));
    return [...years].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  }, [prospects]);

  const filtersActive =
    query.trim() !== "" || position !== "all" || draftClass !== "all" || tier !== "all";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return prospects.filter((p) => {
      const school = (p.school ?? "").toLowerCase();
      if (q && !p.name.toLowerCase().includes(q) && !school.includes(q)) return false;
      if (position !== "all" && p.position !== position) return false;
      if (draftClass !== "all" && p.draftClass !== draftClass) return false;
      if (tier !== "all" && p.tier !== tier) return false;
      return true;
    });
  }, [prospects, query, position, draftClass, tier]);

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

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, position, draftClass, tier, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(DEFAULT_DIR[key]);
    }
  }

  function clearFilters() {
    setQuery("");
    setPosition("all");
    setDraftClass("all");
    setTier("all");
  }

  const rangeStart = sorted.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, sorted.length);

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
            placeholder="Search player or school"
            aria-label="Search player or school"
            className="w-full border border-border-strong bg-surface py-2.5 pl-9 pr-3 text-sm text-ink placeholder:text-ink-tertiary transition-colors duration-150 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/10"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <FilterSelect
            label="Filter by position"
            value={position}
            onChange={(e) => setPosition(e.target.value as Position | "all")}
          >
            <option value="all">All Positions</option>
            {ALL_POSITIONS.map((pos) => (
              <option key={pos} value={pos}>
                {pos}
              </option>
            ))}
          </FilterSelect>

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

      {/* TABLE */}
      <div className="mt-3 overflow-x-auto border border-border">
        <table className="w-full min-w-0 border-collapse text-sm sm:min-w-[700px]">
          <thead>
            <tr className="bg-surface-raised">
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
              <SortTh
                label="Pre-Draft"
                active={sortKey === "preDraftScore"}
                dir={sortDir}
                onClick={() => handleSort("preDraftScore")}
                className="px-1.5 text-right sm:px-4"
              />
              <SortTh
                label="Score"
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
                <td colSpan={7} className="px-6 py-16 text-center">
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
              pageItems.map((p) => (
                <tr
                  key={p.id}
                  className="group border-t border-border transition-colors duration-150 hover:bg-surface-raised"
                >
                  <td className="w-9 px-1.5 py-3 font-mono text-ink-tertiary sm:w-16 sm:px-4">
                    {p.rank ?? "—"}
                  </td>
                  <td className="min-w-[96px] px-1.5 py-3 font-medium text-ink sm:min-w-[200px] sm:px-4">
                    <Link href={`/players/${p.id}`} className="hover:text-accent hover:underline">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-1.5 py-3 sm:px-4">
                    <Badge tone="neutral">{p.position}</Badge>
                  </td>
                  <td className="hidden px-2 py-3 text-ink-secondary sm:table-cell sm:px-4">{p.school ?? "—"}</td>
                  <td className="px-1.5 py-3 text-right font-mono text-ink-secondary sm:px-4">
                    {p.preDraftScore?.toFixed(1) ?? "—"}
                  </td>
                  <td className="px-1.5 py-3 text-right font-mono font-semibold text-ink sm:px-4">
                    {p.grade?.overall?.toFixed(1) ?? (p.preDraftScore !== undefined ? "TBD" : "—")}
                  </td>
                  <td className="px-1.5 py-3 sm:px-4">
                    {p.tier ? <TierBadge tier={p.tier} /> : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
          "flex items-center gap-1.5 font-mono text-[11px] font-medium uppercase tracking-widest2 transition-colors duration-150",
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

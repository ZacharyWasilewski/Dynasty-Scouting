"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X, CornerDownLeft, ArrowUp, ArrowDown, Inbox } from "@/components/ui/SiteIcons";
import { useSearch } from "@/components/search/SearchProvider";
import { Badge } from "@/components/ui/Badge";
import { SchoolLogo } from "@/components/ui/SchoolLogo";
import { cn } from "@/lib/utils";
import { GLOBAL_FORMAT_EVENT, getGlobalFormat } from "@/lib/globalFormat";
import type { LeagueFormat } from "@/lib/ddScore";
import type { Prospect } from "@/types/prospect";

type SearchProspect = Pick<Prospect, "id" | "name" | "position" | "draftClass" | "school" | "schoolLogoUrl"> & {
  ddRank1QB?: number;
  ddRank1QBTEP?: number;
  ddRankSuperflex?: number;
  ddRankSuperflexTEP?: number;
};

function rankForFormat(p: SearchProspect, format: LeagueFormat): number | undefined {
  switch (format) {
    case "1QB": return p.ddRank1QB;
    case "1QB_TEP": return p.ddRank1QBTEP;
    case "SUPERFLEX": return p.ddRankSuperflex;
    case "SUPERFLEX_TEP": return p.ddRankSuperflexTEP;
  }
}

function rankResults(query: string, prospects: SearchProspect[]): SearchProspect[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return prospects
    .map((p) => {
      const name = p.name.toLowerCase();
      let score = -1;
      if (name.startsWith(q)) score = 3;
      else if (name.includes(q)) score = 2;
      return { p, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name))
    .slice(0, 8)
    .map((r) => r.p);
}

export function CommandPalette() {
  const { open, setOpen } = useSearch();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const activeItemRef = useRef<HTMLButtonElement | null>(null);

  // Arrow-key navigation moved the highlight and updated state, but
  // nothing scrolled the results list itself — up to 8 results in a
  // 320px scrollable container is easily enough for keyboard-only
  // navigation to push the highlighted row out of view with zero
  // visual feedback that it happened.
  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);
  const [prospects, setProspects] = useState<SearchProspect[]>([]);
  const snapshotVersionRef = useRef<number | null>(null);
  const loadInFlightRef = useRef<Promise<void> | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [format, setFormat] = useState<LeagueFormat>("SUPERFLEX");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const results = useMemo(() => rankResults(query, prospects), [query, prospects]);

  useEffect(() => {
    const sync = () => setFormat(getGlobalFormat());
    sync();
    window.addEventListener(GLOBAL_FORMAT_EVENT, sync);
    return () => window.removeEventListener(GLOBAL_FORMAT_EVENT, sync);
  }, []);

  // Global Cmd/Ctrl+K shortcut, available on every page since this
  // component is mounted once in the root layout.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setOpen]);

  // Keep search live without re-downloading the full model dataset every time
  // the palette opens. First ask for the tiny canonical version; only a new
  // version triggers the compact search-index payload.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      if (loadInFlightRef.current) return loadInFlightRef.current;
      const work = (async () => {
        setLoading(prospects.length === 0);
        try {
          const versionRes = await fetch("/api/data-version", { cache: "no-store" });
          const versionBody = await versionRes.json() as { version?: number | null };
          const nextVersion = typeof versionBody.version === "number" ? versionBody.version : null;
          if (nextVersion !== null && snapshotVersionRef.current === nextVersion && prospects.length > 0) return;
          const res = await fetch("/api/prospect-index", { cache: "no-store" });
          const data: { prospects?: SearchProspect[]; version?: number; error?: string } = await res.json();
          if (cancelled) return;
          setProspects(data.prospects ?? []);
          if (typeof data.version === "number") snapshotVersionRef.current = data.version;
          setLoadError(Boolean(data.error));
        } catch {
          if (!cancelled) setLoadError(true);
        } finally {
          if (!cancelled) setLoading(false);
          loadInFlightRef.current = null;
        }
      })();
      loadInFlightRef.current = work;
      return work;
    };
    void load();
    return () => { cancelled = true; };
    // `prospects` is intentionally read as the current open-cache state. The
    // effect runs only when the palette opens, not after every search result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function goTo(prospect: SearchProspect) {
    setOpen(false);
    router.push(`/players/${prospect.id}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const selected = results[activeIndex];
      if (selected) {
        e.preventDefault();
        goTo(selected);
      }
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-24 sm:pt-32">
      {/* backdrop */}
      <div
        className="fixed inset-0 animate-fade-in bg-void/80 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* panel */}
      <div className="relative z-10 w-full max-w-xl animate-fade-in-up border border-border-strong bg-surface shadow-2xl [animation-duration:200ms]">
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-4 w-4 shrink-0 text-ink-tertiary" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            type="text"
            placeholder="Search prospects"
            aria-label="Search prospects"
            className="w-full bg-transparent py-4 text-base text-ink placeholder:text-ink-tertiary focus:outline-none"
          />
          <button
            aria-label="Close search"
            onClick={() => setOpen(false)}
            className="flex h-9 w-9 shrink-0 items-center justify-center text-ink-tertiary hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto py-2">
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-ink-tertiary">
              Loading prospects…
            </p>
          ) : loadError ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <Inbox className="h-5 w-5 text-ink-tertiary" strokeWidth={1.5} />
              <p className="text-sm text-ink-secondary">Couldn&apos;t load live data.</p>
              <p className="max-w-xs text-xs text-ink-tertiary">
                Data may be temporarily unreachable. Try again shortly.
              </p>
            </div>
          ) : query.trim() === "" ? (
            <p className="px-4 py-8 text-center text-sm text-ink-tertiary">
              Start typing a prospect name.
            </p>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <Inbox className="h-5 w-5 text-ink-tertiary" strokeWidth={1.5} />
              <p className="text-sm text-ink-secondary">
                No prospects match &ldquo;{query}&rdquo;.
              </p>
              <p className="max-w-xs text-xs text-ink-tertiary">
                Try a different spelling.
              </p>
            </div>
          ) : (
            <ul>
              {results.map((p, i) => (
                <li key={p.id}>
                  <button
                    ref={i === activeIndex ? activeItemRef : undefined}
                    onClick={() => goTo(p)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-100",
                      i === activeIndex ? "bg-surface-raised" : "bg-transparent"
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <span className="font-mono text-xs text-ink-tertiary">
                        {rankForFormat(p, format) ? `#${rankForFormat(p, format)}` : "—"}
                      </span>
                      <span className="font-medium text-ink">{p.name}</span>
                      <span className="flex items-center gap-1 text-xs text-ink-tertiary">
                        <SchoolLogo url={p.schoolLogoUrl} size={12} /> {p.school ?? "—"}
                      </span>
                    </span>
                    <Badge tone="neutral">{p.position}</Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="hidden items-center gap-4 border-t border-border px-4 py-2.5 sm:flex">
          <span className="flex items-center gap-1.5 text-xs text-ink-tertiary">
            <ArrowUp className="h-3 w-3" />
            <ArrowDown className="h-3 w-3" />
            Navigate
          </span>
          <span className="flex items-center gap-1.5 text-xs text-ink-tertiary">
            <CornerDownLeft className="h-3 w-3" />
            Select
          </span>
          <span className="ml-auto flex items-center gap-1.5 text-xs text-ink-tertiary">
            <kbd className="border border-border px-1.5 py-0.5 font-mono text-[10px]">
              Esc
            </kbd>
            Close
          </span>
        </div>
      </div>
    </div>
  );
}

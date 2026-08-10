"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X, CornerDownLeft, ArrowUp, ArrowDown, Inbox } from "lucide-react";
import { useSearch } from "@/components/search/SearchProvider";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import type { Prospect } from "@/types/prospect";

function rankResults(query: string, prospects: Prospect[]): Prospect[] {
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
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const loadedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const results = useMemo(() => rankResults(query, prospects), [query, prospects]);

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

  // Lazily fetch live prospect data (from the Google Sheet, via our
  // API route) the first time the palette is opened, rather than on
  // every page load.
  useEffect(() => {
    if (!open || loadedRef.current) return;
    loadedRef.current = true;
    setLoading(true);
    fetch("/api/prospects")
      .then((res) => res.json())
      .then((data: { prospects?: Prospect[]; error?: string }) => {
        setProspects(data.prospects ?? []);
        setLoadError(Boolean(data.error));
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
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

  function goTo(prospect: Prospect) {
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
            className="w-full bg-transparent py-4 text-sm text-ink placeholder:text-ink-tertiary focus:outline-none"
          />
          <button
            aria-label="Close search"
            onClick={() => setOpen(false)}
            className="flex h-7 w-7 shrink-0 items-center justify-center text-ink-tertiary hover:text-ink"
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
                    onClick={() => goTo(p)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-100",
                      i === activeIndex ? "bg-surface-raised" : "bg-transparent"
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <span className="font-mono text-xs text-ink-tertiary">
                        {p.rank ? `#${p.rank}` : "—"}
                      </span>
                      <span className="font-medium text-ink">{p.name}</span>
                      <span className="text-xs text-ink-tertiary">{p.school ?? "—"}</span>
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

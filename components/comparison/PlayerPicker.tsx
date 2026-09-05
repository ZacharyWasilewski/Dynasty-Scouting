"use client";

import { useMemo, useRef, useState } from "react";
import { X, Search, Users } from "@/components/ui/SiteIcons";
import type { Prospect } from "@/types/prospect";
import { SchoolLogo } from "@/components/ui/SchoolLogo";

function rankResults(query: string, prospects: Prospect[], position?: string): Prospect[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return prospects
    .filter((p) => !position || p.position === position)
    .map((p) => {
      const name = p.name.toLowerCase();
      let score = -1;
      if (name.startsWith(q)) score = 2;
      else if (name.includes(q)) score = 1;
      return { p, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name))
    .slice(0, 8)
    .map((r) => r.p);
}

export function PlayerPicker({
  label,
  prospects,
  positionFilter,
  selected,
  onSelect,
  disabled,
  disabledHint,
}: {
  label: string;
  prospects: Prospect[];
  positionFilter?: string;
  selected: Prospect | null;
  onSelect: (p: Prospect) => void;
  disabled?: boolean;
  disabledHint?: string;
}) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => rankResults(query, prospects, positionFilter), [query, prospects, positionFilter]);
  const showDropdown = focused && query.trim().length > 0;

  return (
    <div className="relative">
      <span className="font-mono text-[11px] uppercase tracking-widest2 text-ink-tertiary">{label}</span>

      {selected ? (
        <div className="mt-2 flex items-center justify-between gap-3 border border-border-strong bg-surface p-4">
          <div className="min-w-0">
            <p className="truncate font-headline text-lg uppercase leading-tight text-ink">{selected.name}</p>
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-ink-tertiary">
              {selected.position} · <SchoolLogo url={selected.schoolLogoUrl} size={12} /> {selected.school ?? "—"} · {selected.draftClass ?? "—"}
            </p>
          </div>
          <button
            onClick={() => {
              onSelect(null as unknown as Prospect);
              setQuery("");
            }}
            className="shrink-0 text-ink-tertiary transition-colors duration-150 hover:text-ink"
            aria-label={`Clear ${label}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" />
          <input
            ref={inputRef}
            value={query}
            disabled={disabled}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder={disabled ? disabledHint ?? "Select the other player first" : "Search prospects"}
            className="w-full border border-border-strong bg-surface py-3 pl-10 pr-4 text-base text-ink placeholder:text-ink-tertiary focus:border-accent/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />

          {showDropdown && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto border border-border-strong bg-surface shadow-xl">
              {results.length === 0 ? (
                <p className="p-4 text-xs text-ink-tertiary">No matches.</p>
              ) : (
                results.map((p) => (
                  <button
                    key={p.id}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onSelect(p);
                      setQuery("");
                    }}
                    className="flex w-full items-center justify-between gap-3 border-b border-border p-3 text-left transition-colors duration-100 last:border-b-0 hover:bg-surface-raised"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{p.name}</p>
                      <p className="flex items-center gap-1 truncate text-xs text-ink-tertiary">
                        {p.position} · <SchoolLogo url={p.schoolLogoUrl} size={12} /> {p.school ?? "—"} · {p.draftClass ?? "—"}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

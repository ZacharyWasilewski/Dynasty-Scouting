"use client";

import { Search } from "lucide-react";
import { useSearch } from "@/components/search/SearchProvider";

/**
 * Homepage hero search field. It's a trigger for the same global
 * command palette used everywhere else on the site (⌘K), so results
 * stay consistent regardless of where a search starts.
 */
export function SearchBar() {
  const { setOpen } = useSearch();

  return (
    <button
      onClick={() => setOpen(true)}
      aria-label="Search prospects"
      className="group relative flex w-full max-w-xl items-center border border-border-strong bg-surface py-4 pl-13 pr-4 text-left text-sm text-ink-tertiary transition-all duration-200 hover:border-accent/40 hover:bg-surface-raised"
      style={{ paddingLeft: "3.25rem" }}
    >
      <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-tertiary transition-colors duration-200 group-hover:text-accent" />
      Search prospects
      <kbd className="ml-auto hidden shrink-0 border border-border-strong px-1.5 py-0.5 font-mono text-[10px] text-ink-tertiary sm:inline-block">
        ⌘K
      </kbd>
    </button>
  );
}

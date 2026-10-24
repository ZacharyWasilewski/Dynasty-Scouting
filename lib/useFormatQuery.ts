"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { GLOBAL_FORMAT_EVENT, getGlobalFormat, parseFormatParam } from "@/lib/globalFormat";
import { FORMAT_QUERY_PARAM } from "@/lib/playerLinks";

/** Paths whose pages read ?format=, so links to them should carry it. */
const FORMAT_AWARE_PREFIXES = ["/players", "/classes", "/positions", "/compare", "/board", "/analytics"];

export function isFormatAwarePath(href: string): boolean {
  const path = href.split("?")[0] ?? href;
  return FORMAT_AWARE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

/** Appends ?format= (or &format=) to an internal href. Pure, for tests. */
export function withFormatParam(href: string, format: string | null | undefined): string {
  if (!format || !isFormatAwarePath(href) || /[?&]format=/.test(href)) return href;
  const [pathAndQuery, hash] = href.split("#");
  const joined = `${pathAndQuery}${pathAndQuery?.includes("?") ? "&" : "?"}format=${format}`;
  return hash ? `${joined}#${hash}` : joined;
}

/**
 * The format query value header/footer links should carry: the page's own
 * explicit ?format= when it has one, otherwise the saved preference. Read in
 * an effect so the first client render matches the server render.
 */
export function useFormatQuery(): string | null {
  const pathname = usePathname();
  const [value, setValue] = useState<string | null>(null);
  useEffect(() => {
    const compute = () => {
      const explicit = parseFormatParam(new URLSearchParams(window.location.search).get("format"));
      setValue(FORMAT_QUERY_PARAM[explicit ?? getGlobalFormat()]);
    };
    compute();
    window.addEventListener(GLOBAL_FORMAT_EVENT, compute);
    return () => window.removeEventListener(GLOBAL_FORMAT_EVENT, compute);
  }, [pathname]);
  return value;
}

"use client";

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
 * Header/footer links no longer carry a format: switching pages starts the new
 * page on its own default. Kept so existing callers stay valid.
 */
export function useFormatQuery(): string | null {
  return null;
}

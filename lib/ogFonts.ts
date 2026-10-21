import { readFileSync } from "fs";
import path from "path";

/**
 * Shared between every dynamic OG image route on the site, so
 * there's one copy of this font-loading logic, not a separately-
 * drifting one per route.
 *
 * This used to fetch these fonts live from Google Fonts on every
 * request. Reported directly, with a build log: that failed the
 * production build outright, because app/opengraph-image.tsx (unlike
 * the player-page route, which is force-dynamic) gets statically
 * prerendered at build time, and the build environment has no
 * network path to fonts.gstatic.com. The failure mode was worse than
 * just that one route, though — Satori (next/og's renderer) throws
 * "No fonts are loaded" if it ever receives an empty font list, and
 * this file's own error handling was catching a failed fetch and
 * returning [] as a "graceful" fallback, which is actually not
 * graceful at all: it guarantees a hard crash instead of one. That
 * would have reproduced live in production too, on any request where
 * Google Fonts happened to be slow or unreachable, not just at build
 * time.
 *
 * Fixed at the actual source rather than patched: these three fonts
 * (Anton / IBM Plex Mono / Inter — see tailwind.config.ts's own
 * font-headline/font-mono/font-body) are bundled as real files in
 * public/fonts/, copied from the @fontsource npm packages, and read
 * from disk. No network call, no runtime dependency on Google Fonts
 * being reachable, works identically at build time and at request
 * time.
 */
function loadLocalFont(filename: string): ArrayBuffer {
  const buffer = readFileSync(path.join(process.cwd(), "public", "fonts", filename));
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

export type OgFont = { name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" };

/** The site's real headline/mono/body faces (Anton / IBM Plex Mono /
 *  Inter), loaded together from the bundled local files above. */
export function loadSiteOgFonts(): OgFont[] {
  return [
    { name: "Anton", data: loadLocalFont("anton-400.woff"), weight: 400, style: "normal" },
    { name: "IBM Plex Mono", data: loadLocalFont("ibm-plex-mono-400.woff"), weight: 400, style: "normal" },
    { name: "IBM Plex Mono", data: loadLocalFont("ibm-plex-mono-600.woff"), weight: 700, style: "normal" },
    { name: "Inter", data: loadLocalFont("inter-400.woff"), weight: 400, style: "normal" },
  ];
}

/** Real site tokens (light theme), read directly from
 *  app/globals.css rather than re-picked per route. */
export const OG_COLORS = {
  void: "#F6F7F9",
  surface: "#FFFFFF",
  border: "#E3E5E9",
  ink: "#14161B",
  inkSecondary: "#565D6B",
  inkTertiary: "#6B7280",
  accent: "#2563EB",
};

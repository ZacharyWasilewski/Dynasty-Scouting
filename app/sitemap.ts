import type { MetadataRoute } from "next";
import { getProspects } from "@/lib/googleSheets";
import { getTrackedClassYears } from "@/lib/classCycle";
import { POSITION_THEMES } from "@/lib/positionThemes";

const BASE_URL = "https://dynastydatabase.com";

// Built from the live prospect snapshot rather than a checked-in list,
// so a newly added player or class year is discoverable without a
// deploy — the same rule every other data-driven page follows.
//
// Not force-dynamic/revalidate=0 though — that meant every single
// crawler hit rebuilt the entire sitemap from scratch (mapping every
// player in the database into XML), measured at 1645ms in production
// logs, even though the underlying data only actually changes on its
// own 60s cache cycle. A crawler doesn't need millisecond freshness;
// an hour-old sitemap is still trivially "dynamic" by the site's own
// standard (no deploy needed to reflect new content) while letting
// repeat requests in that window return instantly instead of
// recomputing.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = ["", "/players", "/classes", "/compare", "/mock-draft", "/analytics", "/methodology", "/glossary", "/about"];

  let prospects: Awaited<ReturnType<typeof getProspects>> = [];
  try {
    prospects = await getProspects();
  } catch {
    // A sheet hiccup shouldn't produce a 500 for crawlers — fall back
    // to the static routes, which are always valid.
  }

  const now = new Date();

  return [
    ...staticRoutes.map((path) => ({
      url: `${BASE_URL}${path}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: path === "" ? 1 : 0.8,
    })),
    ...Object.keys(POSITION_THEMES).map((position) => ({
      url: `${BASE_URL}/positions/${position}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...getTrackedClassYears(prospects).map((year) => ({
      url: `${BASE_URL}/classes/${year}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...prospects.map((p) => ({
      url: `${BASE_URL}/players/${p.id}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}

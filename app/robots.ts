import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

/**
 * Both /robots.txt and /sitemap.xml were returning 404 in production.
 * For a site whose growth depends on being found for player and class
 * searches, that's a real discoverability gap rather than a cosmetic
 * one.
 *
 * Account-only and personal routes are disallowed: they require a
 * session, so a crawler only ever sees an empty logged-out shell, and
 * indexing those wastes crawl budget that should go to player pages.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",  // includes /api/health, which is fine to keep out of results either way
        "/admin/",
        "/my-stuff",
        "/watchlist",
        "/board",
        "/mock-drafts",
        "/team-sync",
        "/login",
        "/signup",
        "/forgot-password",
        "/reset-password",
        "/shared/",
      ],
    },
    sitemap: "https://dynastydatabase.com/sitemap.xml",
  };
}

import { ImageResponse } from "next/og";
import { loadSiteOgFonts, OG_COLORS } from "@/lib/ogFonts";

export const runtime = "nodejs";
export const alt = "Dynasty Database";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The site-wide default preview — every page except an individual
 * player profile (which has its own share-image route) used a static
 * PNG logo file before this. Two real problems with it, both
 * reported directly: it has a transparent background, so the white
 * lettering disappears on the plain white/light card background most
 * platforms (iMessage, Slack, Discord) render link previews on — and
 * it's 845×270, not the 1200×630 the metadata itself already claimed
 * it was, which is exactly the kind of declared-vs-actual mismatch
 * that can make a platform crop or reject the image outright.
 *
 * Next.js's own file-convention (a root-level opengraph-image.tsx
 * using ImageResponse) replaces that static file, matching the same
 * rebuilt design language and shared font loading as the player
 * pages, generated correctly at the real, declared size every time
 * instead of relying on a static asset staying in sync by hand.
 */
export default async function Image() {
  const fonts = await loadSiteOgFonts();
  const c = OG_COLORS;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: c.void,
          fontFamily: "Inter",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
            margin: 40,
            padding: "56px",
            background: c.surface,
            border: `1px solid ${c.border}`,
            borderLeft: `6px solid ${c.accent}`,
          }}
        >
          <span
            style={{
              display: "flex",
              fontFamily: "IBM Plex Mono",
              fontWeight: 700,
              fontSize: 22,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: c.accent,
            }}
          >
            Dynasty Database
          </span>
          <div
            style={{
              display: "flex",
              marginTop: 24,
              fontFamily: "Anton",
              fontWeight: 400,
              fontSize: 76,
              lineHeight: 0.95,
              letterSpacing: "-0.02em",
              textTransform: "uppercase",
              color: c.ink,
            }}
          >
            Dynasty Prospect Intelligence
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 24,
              fontFamily: "IBM Plex Mono",
              fontWeight: 400,
              fontSize: 22,
              letterSpacing: "0.03em",
              color: c.inkSecondary,
            }}
          >
            Analytical grades, position rankings, and draft-class boards
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 40,
              paddingTop: 24,
              borderTop: `1px solid ${c.border}`,
              fontFamily: "IBM Plex Mono",
              fontWeight: 400,
              fontSize: 16,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: c.inkTertiary,
            }}
          >
            Prospect research · Historical comparisons · Rookie draft tools
          </div>
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}

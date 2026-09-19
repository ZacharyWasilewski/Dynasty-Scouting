import { ImageResponse } from "next/og";
import { getProspects } from "@/lib/googleSheets";
import { getPositionTheme } from "@/lib/positionThemes";
import { getDDScore } from "@/lib/ddScore";
import { getDisplayedPreDraftScore } from "@/lib/prospects";
import { getTierForScore } from "@/lib/tiers";
import { loadSiteOgFonts, OG_COLORS } from "@/lib/ogFonts";
import { OgCardShell, OgStat } from "@/lib/ogCardShell";

export const runtime = "nodejs";
export const alt = "Position rankings, Dynasty Database";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Same "Position Group" / big label / description structure as the
 *  real page's own header (components/positions/PositionHeader.tsx),
 *  using that same header's theme.accent color rather than picking a
 *  new one, plus a top-prospect highlight matching the class-year
 *  image's own pattern for consistency across the sweep. */
export default async function Image({ params }: { params: { position: string } }) {
  const theme = getPositionTheme(params.position);
  const allProspects = await getProspects();
  const prospects = theme ? allProspects.filter((p) => p.position === theme.code) : [];

  const format = "SUPERFLEX" as const;
  const scored = prospects
    .map((p) => ({ p, score: p.hasDraftData === true ? getDDScore(p, format) : getDisplayedPreDraftScore(p, format) }))
    .filter((x): x is { p: (typeof prospects)[number]; score: number } => x.score !== undefined)
    .sort((a, b) => b.score - a.score);
  const top = scored[0];
  const topTier = top ? getTierForScore(top.score) : undefined;
  const accent = theme?.accent ?? OG_COLORS.accent;

  const fonts = await loadSiteOgFonts();

  return new ImageResponse(
    (
      <OgCardShell contextLabel={theme ? `${prospects.length} prospects` : undefined} accentColor={accent}>
        <span style={{ display: "flex", fontFamily: "Anton", fontWeight: 400, fontSize: 22, letterSpacing: "-0.01em", textTransform: "uppercase", color: accent }}>
          Position Group
        </span>
        <span style={{ display: "flex", marginTop: 4, fontFamily: "Anton", fontWeight: 400, fontSize: 84, lineHeight: 0.95, textTransform: "uppercase", color: OG_COLORS.ink }}>
          {theme?.label ?? "Position"}
        </span>
        {theme && (
          <span style={{ display: "flex", marginTop: 16, maxWidth: 760, fontFamily: "Inter", fontSize: 20, lineHeight: 1.5, color: OG_COLORS.inkSecondary }}>
            {theme.description}
          </span>
        )}

        {top && (
          <div style={{ display: "flex", alignItems: "center", gap: 40, marginTop: "auto" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ display: "flex", fontFamily: "IBM Plex Mono", fontWeight: 400, fontSize: 15, letterSpacing: "0.15em", textTransform: "uppercase", color: OG_COLORS.inkTertiary }}>
                Top Ranked
              </span>
              <span style={{ display: "flex", marginTop: 6, fontFamily: "Anton", fontWeight: 400, fontSize: 40, textTransform: "uppercase", color: OG_COLORS.ink }}>
                {top.p.name}
              </span>
              <span style={{ display: "flex", marginTop: 4, fontFamily: "IBM Plex Mono", fontWeight: 400, fontSize: 18, color: OG_COLORS.inkSecondary }}>
                {[top.p.school, top.p.draftClass].filter(Boolean).join(" · ")}
              </span>
            </div>
            <OgStat value={top.score.toFixed(1)} label={topTier ?? "Score"} color={accent} />
          </div>
        )}
      </OgCardShell>
    ),
    { ...size, fonts }
  );
}

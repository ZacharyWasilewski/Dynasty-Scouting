import { ImageResponse } from "next/og";
import { getSheetData } from "@/lib/googleSheets";
import { getDDScore } from "@/lib/ddScore";
import { getDisplayedPreDraftScore } from "@/lib/prospects";
import { getTierForScore, getTierColor } from "@/lib/tiers";
import { loadSiteOgFonts, OG_COLORS } from "@/lib/ogFonts";
import { OgCardShell, OgStat } from "@/lib/ogCardShell";

export const runtime = "nodejs";
export const alt = "Draft class, Dynasty Database";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Part of the full-site sweep — every page with its own metadata
 * gets its own matching preview, not just player profiles. Same
 * status-line / big-year structure as the real page's own hero
 * (app/classes/[year]/page.tsx), and the same "current model,
 * appropriate stage" scoring logic already used sitewide for sorting
 * a class (getDDScore for drafted, getDisplayedPreDraftScore
 * otherwise) rather than a separate ad-hoc score just for this image.
 */
export default async function Image({ params }: { params: { year: string } }) {
  const { prospects: allProspects } = await getSheetData();
  const prospects = allProspects.filter((p) => p.draftClass === params.year);
  const currentYear = new Date().getFullYear();
  const yearNumber = Number(params.year);
  const isEarlyWatch = yearNumber > currentYear + 1;
  const status =
    yearNumber > currentYear
      ? yearNumber === currentYear + 1
        ? "Upcoming rookie class · evaluation in progress"
        : "Future class · early watch"
      : yearNumber === currentYear
        ? "Current rookie class · live board"
        : yearNumber === currentYear - 1
          ? "Year two · first NFL season complete"
          : `Historical class · ${currentYear - yearNumber} years of NFL context`;

  const format = "SUPERFLEX" as const;
  const scored = prospects
    .map((p) => ({
      p,
      score: p.hasDraftData === true ? getDDScore(p, format) : getDisplayedPreDraftScore(p, format),
    }))
    .filter((x): x is { p: (typeof prospects)[number]; score: number } => x.score !== undefined)
    .sort((a, b) => b.score - a.score);
  const top = scored[0];
  const topTier = top ? getTierForScore(top.score) : undefined;
  const accent = topTier ? getTierColor(topTier) : OG_COLORS.accent;

  const fonts = await loadSiteOgFonts();

  return new ImageResponse(
    (
      <OgCardShell contextLabel={`${prospects.length} prospects`} accentColor={accent}>
        <span style={{ display: "flex", fontFamily: "Anton", fontWeight: 400, fontSize: 24, letterSpacing: "-0.01em", textTransform: "uppercase", color: OG_COLORS.accent }}>
          {status}
        </span>
        <span style={{ display: "flex", marginTop: 4, fontFamily: "Anton", fontWeight: 400, fontSize: 140, lineHeight: 0.9, color: OG_COLORS.ink }}>
          {params.year}
        </span>

        {top && (
          <div style={{ display: "flex", alignItems: "center", gap: 40, marginTop: "auto" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ display: "flex", fontFamily: "IBM Plex Mono", fontWeight: 400, fontSize: 15, letterSpacing: "0.15em", textTransform: "uppercase", color: OG_COLORS.inkTertiary }}>
                Top Prospect
              </span>
              <span style={{ display: "flex", marginTop: 6, fontFamily: "Anton", fontWeight: 400, fontSize: 44, textTransform: "uppercase", color: OG_COLORS.ink }}>
                {top.p.name}
              </span>
              <span style={{ display: "flex", marginTop: 4, fontFamily: "IBM Plex Mono", fontWeight: 400, fontSize: 18, color: OG_COLORS.inkSecondary }}>
                {[top.p.position, top.p.school].filter(Boolean).join(" · ")}
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

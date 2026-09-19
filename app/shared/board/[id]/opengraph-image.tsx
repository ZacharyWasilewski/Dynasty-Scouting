import { ImageResponse } from "next/og";
import { query } from "@/lib/db";
import { getProspects } from "@/lib/googleSheets";
import { getDDScore, getDDTier } from "@/lib/ddScore";
import { getTierColor } from "@/lib/tiers";
import { loadSiteOgFonts, OG_COLORS } from "@/lib/ogFonts";
import { OgCardShell } from "@/lib/ogCardShell";

export const runtime = "nodejs";
export const alt = "Shared Big Board, Dynasty Database";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function getSharedBoard(id: string) {
  const rows = await query<{ class_year: string; prospect_ids: string[] }>(
    `SELECT class_year, prospect_ids FROM shared_boards WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

/**
 * This is one of the two highest-priority pages in the whole sweep —
 * its entire purpose is being shared, more than any other page on
 * the site. Shows the actual top of the person's real board (name,
 * position/school, live score and tier), not a generic "Big Board"
 * card — someone clicking this link should see it's genuinely their
 * friend's specific ranking before they even open it. Same live-
 * score-over-frozen-order approach as the real page: scores/tiers
 * always reflect the current model, only the order is the snapshot.
 */
export default async function Image({ params }: { params: { id: string } }) {
  const board = await getSharedBoard(params.id);
  const allProspects = board ? await getProspects() : [];
  const byId = new Map(allProspects.map((p) => [p.id, p]));
  const format = "SUPERFLEX" as const;
  const ranked = (board?.prospect_ids ?? [])
    .map((id) => byId.get(id))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .slice(0, 5);
  const fonts = await loadSiteOgFonts();

  return new ImageResponse(
    (
      <OgCardShell contextLabel={board ? `${board.class_year} Big Board` : undefined}>
        <span style={{ display: "flex", fontFamily: "Anton", fontWeight: 400, fontSize: 22, letterSpacing: "-0.01em", textTransform: "uppercase", color: OG_COLORS.accent }}>
          Someone&apos;s Personal Ranking
        </span>
        <span style={{ display: "flex", marginTop: 4, fontFamily: "Anton", fontWeight: 400, fontSize: 56, lineHeight: 1, textTransform: "uppercase", color: OG_COLORS.ink }}>
          {board ? `${board.class_year} Big Board` : "Big Board"}
        </span>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 28, border: `1px solid ${OG_COLORS.border}` }}>
          {ranked.map((p, i) => {
            const tier = getDDTier(p, format);
            const score = getDDScore(p, format);
            const color = tier ? getTierColor(tier) : OG_COLORS.inkTertiary;
            return (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "14px 20px",
                  borderTop: i === 0 ? "none" : `1px solid ${OG_COLORS.border}`,
                }}
              >
                <span style={{ display: "flex", width: 28, fontFamily: "IBM Plex Mono", fontSize: 16, color: OG_COLORS.inkTertiary }}>{i + 1}</span>
                <span style={{ display: "flex", flex: 1, fontFamily: "IBM Plex Mono", fontWeight: 700, fontSize: 20, color: OG_COLORS.ink }}>{p.name}</span>
                <span style={{ display: "flex", fontFamily: "IBM Plex Mono", fontSize: 16, color: OG_COLORS.inkTertiary }}>{p.position}</span>
                <span style={{ display: "flex", width: 70, justifyContent: "flex-end", fontFamily: "IBM Plex Mono", fontWeight: 700, fontSize: 20, color }}>
                  {score?.toFixed(1) ?? "—"}
                </span>
              </div>
            );
          })}
        </div>
      </OgCardShell>
    ),
    { ...size, fonts }
  );
}

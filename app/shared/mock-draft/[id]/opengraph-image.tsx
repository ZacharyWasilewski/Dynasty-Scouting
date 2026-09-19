import { ImageResponse } from "next/og";
import { query } from "@/lib/db";
import { getCommunityFormatLabel, formatPick } from "@/lib/mockDraft";
import { loadSiteOgFonts, OG_COLORS } from "@/lib/ogFonts";
import { OgCardShell } from "@/lib/ogCardShell";

export const runtime = "nodejs";
export const alt = "Shared Mock Draft, Dynasty Database";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface SharedPick {
  overall: number;
  playerName: string;
  position: string;
  tier: string | null;
  ddScore: number | null;
  grade: string;
}
interface DraftSettings {
  teams: number;
  qbFormat: "1QB" | "SUPERFLEX";
  teFormat: "STANDARD" | "TEP";
}

async function getSharedDraft(id: string) {
  const rows = await query<{ class_year: string; settings: DraftSettings; picks: SharedPick[]; overall_grade: string | null }>(
    `SELECT class_year, settings, picks, overall_grade FROM saved_mock_drafts WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

/** Raw-hex version of lib/utils.ts's gradeTextColorClass — same
 *  grade→color mapping (including its own already-fixed contrast
 *  values for C/A/B/D/F), just returning a real hex since Satori
 *  can't resolve a Tailwind class string like ImageResponse output
 *  needs actual color values. */
function gradeColor(grade: string | null): string {
  if (!grade) return OG_COLORS.inkTertiary;
  if (grade.startsWith("A")) return "#15803D";
  if (grade.startsWith("B")) return OG_COLORS.accent;
  if (grade.startsWith("C")) return "#8A6608";
  return "#B91C1C";
}

/**
 * The other highest-priority page in the sweep, alongside the shared
 * board — its whole purpose is being sent to someone else. Shows the
 * actual overall grade and real picks from that specific draft, the
 * same way the real page leads with them, not a generic "Mock Draft"
 * card.
 */
export default async function Image({ params }: { params: { id: string } }) {
  const draft = await getSharedDraft(params.id);
  const picks = (draft?.picks ?? []).slice(0, 5);
  const fonts = await loadSiteOgFonts();
  const grade = draft?.overall_grade ?? null;
  const accent = gradeColor(grade);

  return new ImageResponse(
    (
      <OgCardShell contextLabel={draft ? `${draft.class_year} Mock Draft` : undefined} accentColor={accent}>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <span style={{ display: "flex", fontFamily: "Anton", fontWeight: 400, fontSize: 22, letterSpacing: "-0.01em", textTransform: "uppercase", color: OG_COLORS.accent }}>
              A Completed Mock Draft
            </span>
            <span style={{ display: "flex", marginTop: 4, fontFamily: "Anton", fontWeight: 400, fontSize: 48, lineHeight: 1, textTransform: "uppercase", color: OG_COLORS.ink }}>
              {draft ? `${draft.class_year} Mock Draft` : "Mock Draft"}
            </span>
            {draft && (
              <span style={{ display: "flex", marginTop: 10, fontFamily: "IBM Plex Mono", fontSize: 18, color: OG_COLORS.inkSecondary }}>
                {getCommunityFormatLabel(draft.settings.qbFormat, draft.settings.teFormat)} · {draft.settings.teams}-team
              </span>
            )}
          </div>
          {grade && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ display: "flex", fontFamily: "Anton", fontWeight: 400, fontSize: 84, lineHeight: 0.85, color: accent }}>{grade}</span>
              <span style={{ display: "flex", marginTop: 6, fontFamily: "IBM Plex Mono", fontSize: 13, letterSpacing: "0.15em", textTransform: "uppercase", color: OG_COLORS.inkTertiary }}>
                Overall Grade
              </span>
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 24, border: `1px solid ${OG_COLORS.border}` }}>
          {picks.map((pick, i) => (
            <div
              key={pick.overall}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "12px 20px",
                borderTop: i === 0 ? "none" : `1px solid ${OG_COLORS.border}`,
              }}
            >
              <span style={{ display: "flex", width: 56, fontFamily: "IBM Plex Mono", fontSize: 14, color: OG_COLORS.inkTertiary }}>
                {draft ? formatPick(pick.overall, draft.settings.teams) : pick.overall}
              </span>
              <span style={{ display: "flex", flex: 1, fontFamily: "IBM Plex Mono", fontWeight: 700, fontSize: 18, color: OG_COLORS.ink }}>{pick.playerName}</span>
              <span style={{ display: "flex", fontFamily: "IBM Plex Mono", fontSize: 15, color: OG_COLORS.inkTertiary }}>{pick.position}</span>
              <span style={{ display: "flex", width: 60, justifyContent: "flex-end", fontFamily: "IBM Plex Mono", fontWeight: 700, fontSize: 18, color: OG_COLORS.inkSecondary }}>
                {pick.ddScore?.toFixed(1) ?? "—"}
              </span>
              <span style={{ display: "flex", width: 40, justifyContent: "flex-end", fontFamily: "IBM Plex Mono", fontWeight: 700, fontSize: 18, color: gradeColor(pick.grade) }}>
                {pick.grade}
              </span>
            </div>
          ))}
        </div>
      </OgCardShell>
    ),
    { ...size, fonts }
  );
}

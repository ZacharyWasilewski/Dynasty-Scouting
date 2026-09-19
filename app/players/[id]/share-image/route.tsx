import { ImageResponse } from "next/og";
import { getProspectById } from "@/lib/googleSheets";
import { playerShareDetails } from "@/lib/playerMetadata";
import { loadSiteOgFonts, OG_COLORS } from "@/lib/ogFonts";
import { qualitativeLabelForPercentile } from "@/lib/tiers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Rebuilt again — reported directly: this should almost exactly
 * resemble what the user actually sees on the real profile page, not
 * just use its fonts/colors. Two real pieces of the actual page
 * added that were missing entirely: the player's own photo with the
 * school-logo badge overlapping its corner (same treatment as
 * ProfileHeader.tsx — square photo, tier-colored 2px border, rounded
 * logo badge at -bottom-2 -left-2), and a compact version of the
 * subscore bars from that same page's "Prospect Profile" section
 * (same label-above/qualitative-label/thin-bar structure, just the
 * first 4 so it fits one row). Satori (next/og's renderer) only
 * understands a subset of HTML/CSS — plain <img> tags rather than
 * next/image, explicit display: flex on every container since
 * nothing defaults to block the way a browser would — but the actual
 * visual result is meant to read as the same page, not a different,
 * simpler design that happens to share its colors.
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const prospect = await getProspectById(params.id);
  if (!prospect) return new Response("Prospect not found", { status: 404 });
  const details = playerShareDetails(prospect, new URL(request.url).searchParams.get("format") ?? undefined);
  const fonts = await loadSiteOgFonts();
  const c = OG_COLORS;
  const topSubScores = (prospect.subScores ?? []).filter((s) => s.value !== undefined).slice(0, 4);

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
            flex: 1,
            margin: 40,
            padding: "44px 56px",
            background: c.surface,
            border: `1px solid ${c.border}`,
            borderLeft: `6px solid ${details.color}`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span
              style={{
                display: "flex",
                fontFamily: "IBM Plex Mono",
                fontWeight: 700,
                fontSize: 20,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                color: c.accent,
              }}
            >
              Dynasty Database
            </span>
            <span
              style={{
                display: "flex",
                fontFamily: "IBM Plex Mono",
                fontWeight: 400,
                fontSize: 18,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: c.inkTertiary,
              }}
            >
              {details.formatLabel}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 36, marginTop: 32 }}>
            {/* Same treatment as the real profile page: square photo,
                tier-colored border, school-logo badge overlapping the
                bottom-left corner. Falls back to a plain tier-colored
                block (no broken-image icon) when there's no photo,
                same as the real page falls back to a person icon. */}
            <div style={{ position: "relative", width: 168, height: 168, flexShrink: 0 }}>
              <div
                style={{
                  display: "flex",
                  width: "100%",
                  height: "100%",
                  borderRadius: 14,
                  border: `2px solid ${details.color}`,
                  overflow: "hidden",
                  background: c.surface,
                }}
              >
                {prospect.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={prospect.photoUrl} alt={prospect.name} width={168} height={168} style={{ objectFit: "cover", objectPosition: "top" }} />
                )}
              </div>
              {prospect.schoolLogoUrl && (
                <div
                  style={{
                    display: "flex",
                    position: "absolute",
                    bottom: -10,
                    left: -10,
                    width: 48,
                    height: 48,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 10,
                    border: `1px solid ${c.border}`,
                    background: c.surface,
                    padding: 6,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={prospect.schoolLogoUrl} alt="" width={36} height={36} style={{ objectFit: "contain" }} />
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
              <div
                style={{
                  display: "flex",
                  fontFamily: "Anton",
                  fontWeight: 400,
                  fontSize: prospect.name.length > 22 ? 52 : 64,
                  lineHeight: 0.95,
                  letterSpacing: "-0.02em",
                  textTransform: "uppercase",
                  color: c.ink,
                }}
              >
                {prospect.name}
              </div>
              <div
                style={{
                  display: "flex",
                  marginTop: 10,
                  fontFamily: "IBM Plex Mono",
                  fontWeight: 400,
                  fontSize: 20,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: c.inkSecondary,
                }}
              >
                {details.identity}
              </div>

              <div style={{ display: "flex", alignItems: "flex-end", gap: 24, marginTop: 20 }}>
                <div style={{ display: "flex", fontFamily: "Anton", fontWeight: 400, fontSize: 76, lineHeight: 0.85, color: details.color }}>
                  {details.score}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingBottom: 6 }}>
                  <span
                    style={{
                      display: "flex",
                      fontFamily: "IBM Plex Mono",
                      fontWeight: 400,
                      fontSize: 14,
                      letterSpacing: "0.28em",
                      textTransform: "uppercase",
                      color: c.inkTertiary,
                    }}
                  >
                    {details.stageLabel}
                  </span>
                  <span
                    style={{
                      display: "flex",
                      fontFamily: "IBM Plex Mono",
                      fontWeight: 700,
                      fontSize: 22,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: details.color,
                    }}
                  >
                    {details.tier ?? "Awaiting score"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Compact version of the same subscore bars shown on the
              real page's Prospect Profile section — same structure
              (label, qualitative label, thin colored bar), just the
              first 4 laid out in one row instead of a full list. */}
          {topSubScores.length > 0 && (
            <div style={{ display: "flex", gap: 28, marginTop: "auto", paddingTop: 28 }}>
              {topSubScores.map((s) => (
                <div key={s.label} style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span
                      style={{
                        display: "flex",
                        fontFamily: "IBM Plex Mono",
                        fontSize: 13,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: c.inkTertiary,
                      }}
                    >
                      {s.label}
                    </span>
                  </div>
                  <span style={{ display: "flex", marginTop: 2, fontFamily: "IBM Plex Mono", fontWeight: 700, fontSize: 15, color: c.ink }}>
                    {qualitativeLabelForPercentile(s.value as number)}
                  </span>
                  <div style={{ display: "flex", marginTop: 8, width: "100%", height: 5, background: c.border, borderRadius: 3 }}>
                    <div style={{ display: "flex", width: `${s.value}%`, height: "100%", background: details.color, borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div
            style={{
              display: "flex",
              marginTop: topSubScores.length > 0 ? 24 : "auto",
              paddingTop: 20,
              borderTop: `1px solid ${c.border}`,
              fontFamily: "IBM Plex Mono",
              fontWeight: 400,
              fontSize: 15,
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
    { width: 1200, height: 630, fonts, headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } }
  );
}

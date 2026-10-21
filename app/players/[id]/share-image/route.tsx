import { ImageResponse } from "next/og";
import { getProspectById } from "@/lib/googleSheets";
import { playerShareDetails } from "@/lib/playerMetadata";
import { loadSiteOgFonts, OG_COLORS } from "@/lib/ogFonts";
import { qualitativeLabelForPercentile } from "@/lib/tiers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Removed the player photo and school-logo badge — reported directly,
 * with a live 502 from the actual deployed route. A 502 specifically
 * means the upstream Node process itself crashed or hung handling
 * the request, not a clean application error. The two live network
 * calls this route was making to third-party photo/logo hosts at
 * request time (even with a short timeout and a HEAD-request
 * pre-check added to guard against exactly this) were the newest,
 * least-proven part of the route and the most likely source of that
 * kind of failure in a production container — far riskier than the
 * bundled local font files, which involve no network at all. Rather
 * than try to patch the timeout/guard logic a third time without a
 * way to verify it actually works against the real external hosts,
 * removed the dependency entirely: everything this card shows now
 * (name, identity, score, tier, subscore bars) is computed locally
 * from data already in hand, with zero outbound network calls during
 * image generation. A reliable card without a photo beats a broken
 * one with a 502.
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
            padding: "48px 56px",
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

          <div style={{ display: "flex", flexDirection: "column", marginTop: 40 }}>
            <div
              style={{
                display: "flex",
                fontFamily: "Anton",
                fontWeight: 400,
                fontSize: prospect.name.length > 22 ? 64 : 84,
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
                marginTop: 14,
                fontFamily: "IBM Plex Mono",
                fontWeight: 400,
                fontSize: 22,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: c.inkSecondary,
              }}
            >
              {details.identity}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", gap: 28, marginTop: 32 }}>
            <div style={{ display: "flex", fontFamily: "Anton", fontWeight: 400, fontSize: 116, lineHeight: 0.85, color: details.color }}>
              {details.score}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingBottom: 10 }}>
              <span
                style={{
                  display: "flex",
                  fontFamily: "IBM Plex Mono",
                  fontWeight: 400,
                  fontSize: 16,
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
                  fontSize: 26,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: details.color,
                }}
              >
                {details.tier ?? "Awaiting score"}
              </span>
            </div>
          </div>

          {/* Compact version of the same subscore bars shown on the
              real page's Prospect Profile section — same structure
              (label, qualitative label, thin colored bar), just the
              first 4 laid out in one row instead of a full list.
              Entirely local computation, no network involved. */}
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

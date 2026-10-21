import { OG_COLORS } from "@/lib/ogFonts";

/**
 * The outer frame every OG image on the site shares — logo header
 * with a page-specific context label on the right, bordered card,
 * footer tagline. Extracted once rather than copy-pasted into every
 * page-specific route, since this exact structure (and its accent
 * color usage) needs to stay identical across all of them for the
 * site to actually read as one consistent product when different
 * pages get shared next to each other, not a per-page one-off.
 */
export function OgCardShell({
  contextLabel,
  accentColor,
  children,
}: {
  /** Right-aligned header text — e.g. a league format, a class year,
   *  a position name. Optional since not every page has one. */
  contextLabel?: string;
  /** Left border + footer-adjacent accent. Defaults to the site's
   *  own accent blue when a page has no more specific color (a tier
   *  color, a position color) to use instead. */
  accentColor?: string;
  children: React.ReactNode;
}) {
  const c = OG_COLORS;
  const accent = accentColor ?? c.accent;
  return (
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
          borderLeft: `6px solid ${accent}`,
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
          {contextLabel && (
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
              {contextLabel}
            </span>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", flex: 1, marginTop: 32 }}>{children}</div>

        <div
          style={{
            display: "flex",
            marginTop: 24,
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
  );
}

/** Common label/value pair used across several of the OG images
 *  below (a big number + its caption underneath), so that specific
 *  layout doesn't get re-typed per route either. */
export function OgStat({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <span style={{ display: "flex", fontFamily: "Anton", fontWeight: 400, fontSize: 56, lineHeight: 0.85, color }}>{value}</span>
      <span
        style={{
          display: "flex",
          marginTop: 8,
          fontFamily: "IBM Plex Mono",
          fontWeight: 400,
          fontSize: 14,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          color: OG_COLORS.inkTertiary,
        }}
      >
        {label}
      </span>
    </div>
  );
}

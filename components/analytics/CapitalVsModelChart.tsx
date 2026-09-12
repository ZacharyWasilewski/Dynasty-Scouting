"use client";

import { useEffect, useMemo, useState } from "react";
import type { Prospect } from "@/types/prospect";
import { computeCapitalVsModelHitRates, type CapitalVsModelDatum } from "@/lib/analytics";
import { useScoringMode } from "@/components/analytics/ScoringModeContext";
import { useLeagueFormat } from "@/components/analytics/LeagueFormatContext";

const MODEL_COLOR = "var(--color-accent)"; // accent
const CAPITAL_COLOR = "var(--color-ink-tertiary)"; // a real second line, not a disabled state

const WIDTH = 680;
const HEIGHT = 380;
const PAD_TOP = 54;
const PAD_BOTTOM = 88;
// Wider side padding so edge point labels (which extend inward from the
// axis, see textAnchor logic below) never clip against the SVG's own
// viewBox bounds — SVG clips overflow by default.
const PAD_X = 54;

// This SVG scales with its container (className="w-full"), so on a
// ~350px mobile width against a 680-wide viewBox, everything renders at
// roughly half size. Text/markers are sized generously up front so they
// stay legible even after that mobile shrink, not just at desktop width.
const FONT_VALUE = 16; // point value labels
const FONT_TIER = 15; // round/tier axis labels
const FONT_COUNT = 12; // "n=X each" sublabel
const GAP_FAR = 18; // vertical distance from point to its label, values clearly apart
const GAP_CLOSE = 26; // wider distance when the two values are close, so labels don't merge

// Shorter labels for the two combined tiers — "Rounds 4–5" was wide
// enough to clip against the right edge at small container widths.
const SHORT_LABEL: Record<string, string> = {
  "Rounds 4–5": "Rds 4–5",
  "Rounds 6–7+": "Rds 6–7+",
};

function capitalValue(d: CapitalVsModelDatum, weighted: boolean): number | null {
  return weighted ? d.capitalValueScore : d.capitalHitRate;
}
function modelValue(d: CapitalVsModelDatum, weighted: boolean): number | null {
  return weighted ? d.modelValueScore : d.modelHitRate;
}
// Weighted Value Score is shown with a % suffix so it reads comparably
// next to the Standard hit rate — the scale is capped at 0–100 for
// exactly that reason.
function formatValue(v: number): string {
  return `${v.toFixed(0)}%`;
}

export function CapitalVsModelChart({ prospects }: { prospects: Prospect[] }) {
  const [mounted, setMounted] = useState(false);
  const { mode } = useScoringMode();
  const weighted = mode === "weighted";
  const { selection } = useLeagueFormat();

  const data: CapitalVsModelDatum[] = useMemo(
    () => computeCapitalVsModelHitRates(prospects, selection),
    [prospects, selection]
  );

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 40);
    return () => clearTimeout(t);
  }, []);

  const hasData = data.some(
    (d) => capitalValue(d, weighted) !== null || modelValue(d, weighted) !== null
  );

  if (!hasData) {
    return (
      <p className="text-sm text-ink-tertiary">
        Not enough resolved, drafted prospects yet to compare model vs. draft capital.
      </p>
    );
  }

  const maxVal = weighted
    ? 100
    : Math.max(20, ...data.flatMap((d) => [d.capitalHitRate ?? 0, d.modelHitRate ?? 0]));
  const chartTop = PAD_TOP;
  const chartBottom = HEIGHT - PAD_BOTTOM;
  const chartHeight = chartBottom - chartTop;
  const chartLeft = PAD_X;
  const chartRight = WIDTH - PAD_X;
  const stepX = (chartRight - chartLeft) / Math.max(1, data.length - 1);

  const xFor = (i: number) => chartLeft + stepX * i;
  const yFor = (v: number) => chartTop + (1 - v / maxVal) * chartHeight;

  // Edge points anchor their text inward (start/end) instead of centered,
  // so labels grow toward the middle of the chart rather than off the
  // side of the canvas.
  const anchorFor = (i: number): "start" | "middle" | "end" =>
    i === 0 ? "start" : i === data.length - 1 ? "end" : "middle";
  const labelXFor = (i: number) => (i === 0 ? xFor(i) - 8 : i === data.length - 1 ? xFor(i) + 8 : xFor(i));

  function pathFor(getter: (d: CapitalVsModelDatum) => number | null) {
    const pts = data
      .map((d, i) => {
        const v = getter(d);
        return v !== null ? `${xFor(i)},${yFor(v)}` : null;
      })
      .filter((p): p is string => p !== null);
    return pts.length > 0 ? `M ${pts.join(" L ")}` : "";
  }

  // Shade the gap between the two lines wherever both are known — the
  // shaded area IS the model's lift (or deficit) over draft capital.
  const bothDefined = data.every(
    (d) => capitalValue(d, weighted) !== null && modelValue(d, weighted) !== null
  );
  const gapPath = bothDefined
    ? `M ${data.map((d, i) => `${xFor(i)},${yFor(modelValue(d, weighted) as number)}`).join(" L ")} L ${[...data]
        .reverse()
        .map((d, ri) => `${xFor(data.length - 1 - ri)},${yFor(capitalValue(d, weighted) as number)}`)
        .join(" L ")} Z`
    : "";

  // Labels placed below their point can't be pushed past this —
  // otherwise a near-baseline value (e.g. a 2-3% tier) shoves its label
  // straight into the axis text underneath the chart.
  const maxBelowY = chartBottom + 18;
  const tierLabelY = HEIGHT - 52;
  const countLabelY = HEIGHT - 30;

  return (
    <div>
      <div className="mb-5 font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">
        {weighted ? "Showing Weighted Value Score (RP = 50)" : "Showing Standard Hit Rate"}
        {" · "}
        {selection.qbFormat === "1QB" ? "1QB" : "Superflex"}
        {selection.tepFormat === "TEP" ? " TEP" : ""}
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}
        role="img"
        aria-label={
          weighted
            ? "Weighted Value Score by tier: Dynasty Database model vs. real NFL draft capital"
            : "Hit rate by tier: Dynasty Database model vs. real NFL draft capital"
        }
      >
        <line x1={chartLeft} y1={chartBottom} x2={chartRight} y2={chartBottom} stroke="var(--color-border)" strokeWidth={1.5} />

        {gapPath && (
          <path
            d={gapPath}
            fill={MODEL_COLOR}
            fillOpacity={mounted ? 0.08 : 0}
            style={{ transition: "fill-opacity 0.6s ease-out" }}
          />
        )}

        <path
          d={pathFor((d) => capitalValue(d, weighted))}
          fill="none"
          stroke={CAPITAL_COLOR}
          strokeWidth={2.5}
          strokeDasharray="6 6"
        />
        <path d={pathFor((d) => modelValue(d, weighted))} fill="none" stroke={MODEL_COLOR} strokeWidth={3.5} />

        {data.map((d, i) => {
          const capVal = capitalValue(d, weighted);
          const modVal = modelValue(d, weighted);
          // When the two values are close, push labels further apart
          // so they don't visually merge into one number.
          const diff = Math.abs((modVal ?? 0) - (capVal ?? 0));
          const gap = diff < 4 ? GAP_CLOSE : GAP_FAR;
          const modelAbove = (modVal ?? 0) >= (capVal ?? 0);
          const anchor = anchorFor(i);
          const lx = labelXFor(i);

          return (
            <g key={d.tier} opacity={mounted ? 1 : 0} style={{ transition: "opacity 0.4s ease-out 0.5s" }}>
              {capVal !== null && (
                <>
                  <circle cx={xFor(i)} cy={yFor(capVal)} r={5.5} fill={CAPITAL_COLOR} />
                  <text
                    x={lx}
                    y={modelAbove ? Math.min(yFor(capVal) + gap, maxBelowY) : yFor(capVal) - gap}
                    textAnchor={anchor}
                    fill={CAPITAL_COLOR}
                    style={{ fontSize: FONT_VALUE, fontFamily: "var(--font-mono)" }}
                  >
                    {formatValue(capVal)}
                  </text>
                </>
              )}
              {modVal !== null && (
                <>
                  <circle cx={xFor(i)} cy={yFor(modVal)} r={6.5} fill={MODEL_COLOR} />
                  <text
                    x={lx}
                    y={modelAbove ? yFor(modVal) - gap : Math.min(yFor(modVal) + gap, maxBelowY)}
                    textAnchor={anchor}
                    fill={MODEL_COLOR}
                    style={{ fontSize: FONT_VALUE, fontFamily: "var(--font-mono)", fontWeight: 700 }}
                  >
                    {formatValue(modVal)}
                  </text>
                </>
              )}
              <text
                x={lx}
                y={tierLabelY}
                textAnchor={anchor}
                fill="var(--color-ink)"
                style={{ fontSize: FONT_TIER, fontFamily: "var(--font-mono)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}
              >
                {SHORT_LABEL[d.tier] ?? d.tier}
              </text>
              <text
                x={lx}
                y={countLabelY}
                textAnchor={anchor}
                fill={CAPITAL_COLOR}
                style={{ fontSize: FONT_COUNT, fontFamily: "var(--font-mono)" }}
              >
                n={d.capitalCount} each
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-ink-tertiary">
          <span className="h-2 w-2" style={{ backgroundColor: MODEL_COLOR }} />
          DD Model, top players by DD Score
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-ink-tertiary">
          <span className="inline-block h-0 w-3 border-t-2 border-dashed" style={{ borderColor: CAPITAL_COLOR }} />
          Draft Capital, actual round drafted
        </span>
      </div>

      <p className="mt-3 max-w-md text-xs leading-relaxed text-ink-tertiary">
        Each tier contains the same number of players under both methods (
        <span className="text-ink-secondary">n</span>). The gray line groups
        players by where they were actually drafted; the blue line ranks the
        exact same player pool by DD Score, taking the same number of
        players in each tier.
        {weighted && (
          <>
            {" "}
            Value Score averages each player&apos;s outcome quality (SuperStar
            scores highest, RP = 50% push, Bust = 0%), capped at 100% once
            averaged so it stays comparable to a hit rate.
          </>
        )}
      </p>
    </div>
  );
}

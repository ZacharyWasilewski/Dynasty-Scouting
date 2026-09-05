"use client";

import { useEffect, useMemo, useState } from "react";
import type { Prospect } from "@/types/prospect";
import { getCalibrationCurves, type PositionCalibration } from "@/lib/ddScore";
import { useScoringMode } from "@/components/analytics/ScoringModeContext";
import { useAnalyticsPosition } from "@/components/analytics/AnalyticsPositionContext";

const CURVE_COLOR = "var(--color-accent)"; // accent
const BUCKET_COLOR = "var(--color-ink-tertiary)";

const WIDTH = 680;
const HEIGHT = 360;
const PAD_TOP = 24;
const PAD_BOTTOM = 46;
const PAD_X = 46;

const POSITIONS: PositionCalibration["position"][] = ["QB", "RB", "WR", "TE"];

export function CalibrationCurveChart({ prospects }: { prospects: Prospect[] }) {
  const [mounted, setMounted] = useState(false);
  const { position, setPosition } = useAnalyticsPosition();
  const { mode } = useScoringMode();

  const curves = useMemo(() => getCalibrationCurves(prospects, mode), [prospects, mode]);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 40);
    return () => clearTimeout(t);
  }, []);

  const active = curves.find((c) => c.position === position);

  const chartTop = PAD_TOP;
  const chartBottom = HEIGHT - PAD_BOTTOM;
  const chartHeight = chartBottom - chartTop;
  const chartLeft = PAD_X;
  const chartRight = WIDTH - PAD_X;
  const chartWidth = chartRight - chartLeft;

  const xFor = (score: number) => chartLeft + (score / 100) * chartWidth;
  const yFor = (probability: number) => chartTop + (1 - probability / 100) * chartHeight;

  const curvePath = active
    ? `M ${active.curve.map((pt) => `${xFor(pt.score)},${yFor(pt.probability)}`).join(" L ")}`
    : "";

  const maxCount = Math.max(1, ...(active?.buckets.map((b) => b.count) ?? [1]));
  const radiusFor = (count: number) => 3 + Math.sqrt(count / maxCount) * 9;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">
          {mode === "weighted"
            ? "How good the outcome was at each score, on average"
            : "How often players at each score actually hit"}
        </p>
        <div className="inline-flex border border-border bg-surface p-1">
          {POSITIONS.map((pos) => (
            <button
              key={pos}
              type="button"
              onClick={() => setPosition(pos)}
              aria-pressed={position === pos}
              className={`px-3 py-1.5 font-mono text-xs uppercase tracking-wide transition-colors duration-150 ${
                position === pos ? "bg-accent text-void" : "text-ink-tertiary hover:text-ink-secondary"
              }`}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-5 font-mono text-[9px] uppercase tracking-widest text-ink-tertiary">
        The same curve is used for 1QB and Superflex because this test is not format-dependent.
      </p>

      {!active || active.curve.every((pt) => pt.probability === 0) ? (
        <p className="text-sm text-ink-tertiary">Not enough resolved outcomes yet to fit a curve for {position}.</p>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="w-full"
            style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}
            role="img"
            aria-label={`Calibration curve for ${position}: Positional Score vs. historical hit probability`}
          >
            {[0, 25, 50, 75, 100].map((pct) => (
              <g key={pct}>
                <line
                  x1={chartLeft}
                  y1={yFor(pct)}
                  x2={chartRight}
                  y2={yFor(pct)}
                  stroke="var(--color-border)"
                  strokeWidth={1}
                />
                <text
                  x={chartLeft - 10}
                  y={yFor(pct) + 4}
                  textAnchor="end"
                  fill="var(--color-ink-tertiary)"
                  style={{ fontSize: 11, fontFamily: "var(--font-mono)" }}
                >
                  {pct}%
                </text>
              </g>
            ))}
            {[0, 20, 40, 60, 80, 100].map((score) => (
              <text
                key={score}
                x={xFor(score)}
                y={chartBottom + 22}
                textAnchor="middle"
                fill="var(--color-ink-tertiary)"
                style={{ fontSize: 11, fontFamily: "var(--font-mono)" }}
              >
                {score}
              </text>
            ))}
            <text
              x={(chartLeft + chartRight) / 2}
              y={HEIGHT - 6}
              textAnchor="middle"
              fill="var(--color-ink-tertiary)"
              style={{ fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em" }}
            >
              Positional Score
            </text>

            <path
              d={curvePath}
              fill="none"
              stroke={CURVE_COLOR}
              strokeWidth={3}
              opacity={mounted ? 1 : 0}
              style={{ transition: "opacity 0.5s ease-out" }}
            />

            {active.buckets.map((b) => {
              if (b.hitRate === null) return null;
              const cx = xFor((b.scoreMin + b.scoreMax) / 2);
              const cy = yFor(b.hitRate);
              return (
                <circle
                  key={b.scoreMin}
                  cx={cx}
                  cy={mounted ? cy : chartBottom}
                  r={radiusFor(b.count)}
                  fill={BUCKET_COLOR}
                  fillOpacity={0.55}
                  stroke={BUCKET_COLOR}
                  strokeWidth={1.5}
                  style={{ transition: "cy 0.6s ease-out" }}
                />
              );
            })}
          </svg>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="flex items-center gap-1.5 font-mono text-[11px] text-ink-tertiary">
              <span className="h-2 w-3" style={{ backgroundColor: CURVE_COLOR }} />
              What DD Score expects at each score
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[11px] text-ink-tertiary">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: BUCKET_COLOR, opacity: 0.55 }} />
              What actually happened (bigger dot = more players)
            </span>
          </div>

          <p className="mt-3 max-w-xl text-xs leading-relaxed text-ink-tertiary">
            {mode === "weighted" ? (
              <>
                The blue line is DD Score&apos;s prediction, re-run to
                weigh outcome quality instead of a simple hit-or-miss result.
                A SuperStar counts for more than a standard hit, while a
                total bust counts as zero. Each gray dot shows the
                actual average outcome for {position}s in that 10-point
                score range, and bigger dots represent larger samples.
                When a dot sits on the line, the score called that group
                accurately.
              </>
            ) : (
              <>
                The blue line shows DD Score&apos;s prediction for each score range,
                how often a player at that level becomes a real fantasy
                asset. Each gray dot shows the actual hit rate for
                {position}s in that 10-point range, and bigger dots
                represent larger samples. When a dot sits on the line,
                the score called that group accurately. When dots drift
                away from the line, the model has historically run a
                little high or low in that range.
              </>
            )}
          </p>
        </>
      )}
    </div>
  );
}

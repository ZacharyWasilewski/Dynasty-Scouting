"use client";

interface RadarPoint {
  label: string;
  value: number; // 0-100
}

/** Short axis labels for the radar chart — same abbreviation applies
 *  regardless of position since none of these collide. */
const LABEL_ABBREVIATIONS: Record<string, string> = {
  Production: "PROD",
  Accuracy: "ACC",
  "Ball Security": "SEC",
  Rushing: "RUSH",
  "Draft Capital": "ADP",
  Size: "SIZE",
  Speed: "SPD",
  Receiving: "REC",
  Age: "AGE",
  Dominator: "DOM",
  "Breakout Age": "AGE",
  Volume: "VOL",
  "Redzone Threat": "RDZ",
  Athleticism: "ATH",
};

function abbreviate(label: string): string {
  return LABEL_ABBREVIATIONS[label] ?? label.slice(0, 4).toUpperCase();
}

/**
 * A filled polygon radar chart for a player's numeric sub-scores
 * (text-based scores like Opportunity aren't plottable and should be
 * filtered out before passing in). Needs at least 3 points to read
 * as a real shape.
 */
export function SubScoreRadar({
  points,
  size = 260,
  // Only ever hit if a future caller forgets to pass a real tier
  // color — the current one always does. Kept as a CSS variable
  // reference for consistency with the rest of the theme system.
  color = "var(--color-accent)",
  position,
}: {
  points: RadarPoint[];
  size?: number;
  color?: string;
  position?: string;
}) {
  if (points.length < 3) return null;

  const center = size / 2;
  const labelPad = 34;
  const maxRadius = center - labelPad;
  const rings = [0.25, 0.5, 0.75, 1];

  const angleFor = (i: number) => (Math.PI * 2 * i) / points.length - Math.PI / 2;

  const pointAt = (i: number, fraction: number) => {
    const angle = angleFor(i);
    const r = maxRadius * fraction;
    return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) };
  };

  const polygonPoints = points
    .map((p, i) => {
      const { x, y } = pointAt(i, Math.max(0, Math.min(100, p.value)) / 100);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Background web rings */}
      {rings.map((fraction) => {
        const ringPoints = points.map((_, i) => pointAt(i, fraction));
        return (
          <polygon
            key={fraction}
            points={ringPoints.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth={1}
          />
        );
      })}

      {/* Axis spokes */}
      {points.map((_, i) => {
        const outer = pointAt(i, 1);
        return (
          <line
            key={i}
            x1={center}
            y1={center}
            x2={outer.x}
            y2={outer.y}
            stroke="var(--color-border)"
            strokeWidth={1}
          />
        );
      })}

      {/* Data polygon */}
      <polygon points={polygonPoints} fill={color} fillOpacity={0.22} stroke={color} strokeWidth={2} />

      {/* Data vertices */}
      {points.map((p, i) => {
        const { x, y } = pointAt(i, Math.max(0, Math.min(100, p.value)) / 100);
        return <circle key={p.label} cx={x} cy={y} r={3} fill={color} />;
      })}

      {/* Axis labels */}
      {points.map((p, i) => {
        const labelPos = pointAt(i, 1.18);
        const anchor = Math.abs(labelPos.x - center) < 4 ? "middle" : labelPos.x > center ? "start" : "end";
        return (
          <text
            key={p.label}
            x={labelPos.x}
            y={labelPos.y}
            textAnchor={anchor}
            dominantBaseline="middle"
            className="fill-ink-tertiary font-mono uppercase"
            style={{ fontSize: 9, letterSpacing: "0.04em" }}
          >
            {abbreviate(p.label)}
          </text>
        );
      })}
    </svg>
  );
}

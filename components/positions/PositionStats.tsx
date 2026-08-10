import type { Prospect } from "@/types/prospect";
import type { PositionTheme } from "@/lib/positionThemes";

export function PositionStats({
  prospects,
  theme,
}: {
  prospects: Prospect[];
  theme: PositionTheme;
}) {
  const total = prospects.length;
  const eliteCount = prospects.filter(
    (p) => p.tier === "Generational" || p.tier === "Elite"
  ).length;
  const top = [...prospects]
    .filter((p) => p.rank !== undefined)
    .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity))[0];

  // "Next Man Up" — the top Pre-Draft Score prospect from the most
  // recent future class tracked for this position (currently 2027,
  // but this stays correct automatically as classes roll forward).
  const hasPreDraft = (year: string) =>
    prospects.some((p) => p.draftClass === year && p.preDraftScore !== undefined);

  const latestFutureClass = [...new Set(prospects.map((p) => p.draftClass))]
    .filter((y): y is string => !!y && hasPreDraft(y))
    .sort((a, b) => Number(b) - Number(a))[0];

  const nextManUp = latestFutureClass
    ? [...prospects]
        .filter((p) => p.draftClass === latestFutureClass && p.preDraftScore !== undefined)
        .sort((a, b) => (b.preDraftScore ?? 0) - (a.preDraftScore ?? 0))[0]
    : undefined;

  const stats = [
    { label: "Prospects Graded", value: String(total), isName: false },
    { label: "Elite+ Prospects", value: String(eliteCount), isName: false },
    { label: "Next Man Up", value: nextManUp ? nextManUp.name : "—", isName: true },
    { label: "Top Ranked", value: top ? top.name : "—", isName: true },
  ];

  // Names need to stay on one line and never get cut off, but should
  // use as much of the available space as they can. Scale down in
  // steps as the name gets longer instead of one blunt threshold.
  function nameSizeClass(len: number) {
    if (len <= 10) return "text-2xl sm:text-3xl";
    if (len <= 13) return "text-xl sm:text-2xl";
    if (len <= 16) return "text-lg sm:text-xl";
    if (len <= 20) return "text-base sm:text-lg";
    return "text-sm sm:text-base";
  }

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden border border-border bg-border lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="bg-surface p-6">
          <span className="font-mono text-[11px] uppercase tracking-widest2 text-ink-tertiary">
            {s.label}
          </span>
          <p
            className={
              s.isName
                ? `mt-2 whitespace-nowrap font-mono font-semibold leading-tight ${nameSizeClass(s.value.length)}`
                : "mt-2 truncate font-mono text-2xl font-semibold sm:text-3xl"
            }
            style={{ color: s.value === "—" ? undefined : theme.accent }}
          >
            {s.value}
          </p>
        </div>
      ))}
    </div>
  );
}

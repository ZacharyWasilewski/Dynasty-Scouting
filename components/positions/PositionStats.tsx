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

  // Names are intentionally allowed to wrap. Never clip a player name
  // just to preserve a single-line card height — the card can grow instead.
  function nameSizeClass(len: number) {
    if (len <= 13) return "text-base sm:text-xl lg:text-2xl";
    if (len <= 20) return "text-sm sm:text-lg lg:text-xl";
    return "text-sm sm:text-base lg:text-lg";
  }

  return (
    <div className="grid grid-cols-2 gap-px border border-border bg-border lg:grid-cols-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="flex min-h-[132px] flex-col items-center justify-center bg-surface px-3 py-5 text-center sm:min-h-[164px] sm:px-6 sm:py-6"
        >
          <span className="max-w-full font-mono text-[10px] uppercase leading-relaxed tracking-widest2 text-ink-tertiary sm:text-[11px]">
            {s.label}
          </span>
          <p
            className={
              s.isName
                ? `mt-3 max-w-full whitespace-normal break-words font-mono font-semibold leading-tight ${nameSizeClass(s.value.length)}`
                : "mt-3 font-mono text-2xl font-semibold sm:text-3xl"
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

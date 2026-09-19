import { playerScoreStage, tierHistoryLabel } from "@/lib/scoreStage";
import { Bookmark } from "@/components/ui/SiteIcons";
import type { Prospect, Tier } from "@/types/prospect";
import { cn } from "@/lib/utils";
import { getTierColor } from "@/lib/tiers";
import { POSITION_DOT } from "@/lib/mockDraftFormat";

/** Available-player row. The identity block is always sticky so the
 *  horizontal list can scroll natively without a JS threshold/snap
 *  between two different name layouts.
 *
 *  Extracted from MockDraftExperience.tsx (which was 2,200+ lines) —
 *  every prop here was already just a plain value or callback passed
 *  down, no closure over that component's own internal state, so
 *  this was a self-contained piece to begin with. */
export function AvailablePlayerRow({
  p,
  rank,
  score,
  tier,
  cr,
  diff,
  canPick,
  isSuggested,
  positionTierHitRates,
  queue,
  toggleQueued,
  setExpandedPlayerId,
  closePlayerSearch,
  makePick,
}: {
  p: Prospect;
  rank: number | string;
  score: number | undefined;
  tier: Tier | undefined;
  cr: number | undefined;
  diff: number | null;
  canPick: boolean;
  isSuggested: boolean;
  positionTierHitRates: Map<string, number>;
  queue: string[];
  toggleQueued: (id: string) => void;
  setExpandedPlayerId: (id: string | null) => void;
  closePlayerSearch: () => void;
  makePick: (player: Prospect, userPick: boolean) => void;
}) {
  return (
    <div
      className={cn("mock-player-row flex w-max min-w-full items-center gap-0 border-b border-border-strong border-l-[3px] bg-surface px-0", canPick && "sm:hover:bg-surface-raised/70")}
      style={{ borderLeftColor: tier ? getTierColor(tier) : "transparent" }}
    >
      <div className="mock-player-identity order-2 flex h-full w-[190px] md:order-none min-w-[190px] items-center gap-2 bg-surface px-3 py-2 sm:w-[220px] sm:min-w-[220px] sm:px-4">
        <span className="w-7 shrink-0 text-right font-mono tabular-nums text-[10px] text-ink-tertiary">{rank}</span>
        <span className={cn("h-2 w-2 shrink-0 rounded-full", POSITION_DOT[p.position])} />
        <button
          type="button"
          onClick={() => {
            setExpandedPlayerId(p.id);
            closePlayerSearch();
          }}
          className="min-w-0 flex-1 text-left"
          aria-haspopup="dialog"
        >
          <span className="flex min-w-0 items-center gap-1">
            <span className="min-w-0 whitespace-normal break-words text-sm font-semibold leading-tight text-ink max-md:whitespace-nowrap max-md:break-normal">
              <span className="md:hidden block min-w-0 truncate">{p.name}</span>
              <span className="hidden md:inline">{p.name}</span>
            </span>
          </span>
          {isSuggested && (
            <span className="mt-1 inline-flex rounded-full bg-accent/15 px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-widest2 text-accent">
              Need
            </span>
          )}
        </button>
      </div>
      <div className="mock-player-actions flex h-full shrink-0 items-center bg-surface pl-2">
        {canPick && (
          <button
            type="button"
            onClick={() => { closePlayerSearch(); makePick(p, true); }}
            className="mock-player-pick order-1 mr-2 flex h-[42px] w-[84px] min-w-[84px] max-w-[84px] shrink-0 flex-none items-center justify-center whitespace-nowrap bg-accent px-3 py-2 text-xs font-semibold text-white hover:bg-accent-dim md:order-2 md:mr-0 md:ml-2 md:w-auto md:min-w-[96px] md:max-w-none md:flex-none md:px-5"
            aria-label={`Pick ${p.name}`}
          >
            Pick
          </button>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); toggleQueued(p.id); }}
          aria-label={queue.includes(p.id) ? `Remove ${p.name} from queue` : `Add ${p.name} to queue`}
          className={cn("mock-player-bookmark order-3 ml-2 flex h-[42px] w-[56px] shrink-0 items-center justify-center border-r border-border-strong bg-surface md:order-1 md:ml-0", queue.includes(p.id) ? "bg-accent/10 text-accent" : "text-ink-tertiary hover:text-ink")}
        >
          <Bookmark className="h-5 w-5" fill={queue.includes(p.id) ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="mock-player-stat order-4 shrink-0 md:order-none border-l border-border px-3"><p className="whitespace-nowrap text-[10px] text-ink-tertiary">{p.hasDraftData === true ? "DD Score" : "Pre-Draft"}</p><p className="mt-0.5 whitespace-nowrap tabular-nums text-xs font-semibold text-ink">{score?.toFixed(1) ?? "TBD"}</p></div>
      <div className="mock-player-stat mock-player-stat-history order-5 shrink-0 md:order-none border-l border-border px-3"><p className="whitespace-nowrap text-[10px] text-ink-tertiary">{tierHistoryLabel(p, "mock")} hit %</p><p className="mt-0.5 whitespace-nowrap tabular-nums text-xs font-semibold text-ink">{tier && positionTierHitRates.get(`${playerScoreStage(p, "mock")}:${p.position}:${tier}`) !== undefined ? `${positionTierHitRates.get(`${playerScoreStage(p, "mock")}:${p.position}:${tier}`)!.toFixed(0)}% (n=${positionTierHitRates.get(`sample:${playerScoreStage(p, "mock")}:${p.position}:${tier}`) ?? 0})` : "—"}</p></div>
      <div className="mock-player-stat order-6 shrink-0 md:order-none border-l border-border px-3"><p className="whitespace-nowrap text-[10px] text-ink-tertiary">COMM</p><p className={cn("mt-0.5 whitespace-nowrap tabular-nums text-xs font-semibold", diff === null ? "text-ink-tertiary" : diff > 0 ? "text-riser" : diff < 0 ? "text-faller" : "text-ink-secondary")}>{cr ?? "—"}</p></div>
      {/* Draft Proj and School removed — reported directly as
          wanting numeric values only. Real subscores added in
          their place instead: reported directly that different
          rows don't need to show the same stats, as long as each
          one carries its own header, which every subscore already
          does (its own label). Filtered to value !== undefined
          specifically — a subscore can be text-only (e.g. "QB1"
              instead of a percentile), and those stay excluded to
              keep this numeric-only, same as Tier Hit Rate/DD Score/
              COMM already are. This is also genuinely why different
              positions now show different columns here (a QB and a
              WR have different subscores), matching what was reported
              as the actual Sleeper behavior, not something invented
              to look similar to it. */}
          {p.subScores?.filter((s): s is typeof s & { value: number } => s.value !== undefined).map((s) => (
            <div key={s.label} className="mock-player-stat order-7 shrink-0 md:order-none border-l border-border px-3">
              <p className="whitespace-nowrap text-[10px] text-ink-tertiary">{s.label}</p>
              <p className="mt-0.5 whitespace-nowrap tabular-nums text-xs font-semibold text-ink">{s.value}</p>
            </div>
          ))}
    </div>
  );
}

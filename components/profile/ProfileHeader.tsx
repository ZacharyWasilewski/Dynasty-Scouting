import Link from "next/link";
import { User } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { TierBadge } from "@/components/rankings/TierBadge";
import { ScoreRing } from "@/components/profile/ScoreRing";
import { SubScoreRadar } from "@/components/profile/SubScoreRadar";
import { getTierColor, getTierForScore, getOpportunityColor } from "@/lib/tiers";
import { subScoreSlug, subScoreDescription } from "@/lib/methodologySlugs";
import type { Prospect } from "@/types/prospect";

export function ProfileHeader({ prospect }: { prospect: Prospect }) {
  const numericScores = (prospect.subScores ?? [])
    .filter((s): s is { label: string; value: number; text?: string; isElite?: boolean } => s.value !== undefined)
    .map((s) => ({ label: s.label, value: s.value }));

  return (
    <section className="border-b border-border bg-grid-columns bg-radial-vignette">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-12 lg:px-8 lg:py-16">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start">
          {/* Photo placeholder */}
          <div className="flex h-40 w-40 shrink-0 items-center justify-center border border-border-strong bg-surface sm:h-48 sm:w-48">
            <User className="h-16 w-16 text-ink-tertiary" strokeWidth={1} />
          </div>

          <div className="flex-1">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {prospect.rank && <Badge tone="outline">#{prospect.rank} Overall</Badge>}
                  {prospect.tier && (
                    <TierBadge tier={prospect.tier} href={`/players?tier=${encodeURIComponent(prospect.tier)}`} />
                  )}
                  {prospect.draftClass && (
                    <Link href={`/classes/${prospect.draftClass}`}>
                      <Badge tone="neutral" className="transition-opacity duration-150 hover:opacity-80">
                        {prospect.draftClass} Draft Class
                      </Badge>
                    </Link>
                  )}
                </div>

                <h1 className="mt-4 font-display text-4xl font-semibold tracking-tightest text-ink sm:text-5xl">
                  {prospect.name}
                </h1>

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-secondary">
                  <span className="font-mono text-sm font-semibold text-accent">
                    {prospect.position}
                  </span>
                  <span className="text-ink-tertiary">·</span>
                  <span className="text-sm">{prospect.school ?? "—"}</span>
                </div>
              </div>

              {/* Polygon chart of the numeric sub-scores */}
              {numericScores.length >= 3 && (
                <div className="shrink-0">
                  <SubScoreRadar
                    points={numericScores}
                    position={prospect.position}
                    color={prospect.tier ? getTierColor(prospect.tier) : "#3B82F6"}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sub-score rings, laid out horizontally below the photo/name/chart */}
        {prospect.subScores && prospect.subScores.length > 0 && (
          <div>
            {(() => {
              const scores = prospect.subScores!;
              const ring = (s: (typeof scores)[number]) => (
                <ScoreRing
                  key={s.label}
                  label={s.label}
                  value={s.value}
                  text={s.text}
                  size={64}
                  decimals={0}
                  info={subScoreDescription(prospect.position, s.label)}
                  infoHref={`/methodology#${subScoreSlug(prospect.position, s.label)}`}
                  color={
                    s.isElite
                      ? getTierColor("Elite")
                      : s.value !== undefined
                      ? getTierColor(getTierForScore(s.value) ?? "Roster Clogger")
                      : getOpportunityColor(prospect.position, s.text)
                  }
                />
              );

              return (
                <>
                  {/* Desktop / tablet: one even horizontal row */}
                  <div className="hidden flex-wrap items-start gap-x-10 gap-y-6 sm:flex">
                    {scores.map(ring)}
                  </div>

                  {/* Mobile: symmetric rows — 3-over-2 trapezoid for 5
                      scores, a clean 2x3 grid for 6, centered flow
                      otherwise */}
                  <div className="sm:hidden">
                    {scores.length === 5 ? (
                      <div className="flex flex-col items-center gap-y-6">
                        <div className="flex justify-center gap-x-8">
                          {scores.slice(0, 3).map(ring)}
                        </div>
                        <div className="flex justify-center gap-x-8">
                          {scores.slice(3, 5).map(ring)}
                        </div>
                      </div>
                    ) : scores.length === 6 ? (
                      <div className="grid grid-cols-3 justify-items-center gap-x-4 gap-y-6">
                        {scores.map(ring)}
                      </div>
                    ) : (
                      <div className="flex flex-wrap justify-center gap-x-8 gap-y-6">
                        {scores.map(ring)}
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
            <p className="mt-4 whitespace-nowrap font-mono text-[9px] text-ink-tertiary sm:text-[11px]">
              (All scores are percentile based, on a scale of 0-100)
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

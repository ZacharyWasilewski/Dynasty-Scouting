import Image from "next/image";
import type { Prospect, Tier } from "@/types/prospect";
import type { MockQBFormat, MockTEFormat } from "@/lib/mockDraft";
import { mockLeagueFormat } from "@/lib/mockDraft";
import { applyFormatAdjustment } from "@/lib/formatAdjustment";
import { ScoreRing } from "@/components/profile/ScoreRing";
import { DecisionSignals } from "@/components/profile/DecisionSignals";
import { subScoreDescription, subScoreSlug } from "@/lib/methodologySlugs";
import { getTierColor, getTierForScore, getOpportunityColor } from "@/lib/tiers";
import { cn } from "@/lib/utils";

/** Same tiny stat box already used throughout the draft room — copied
 *  rather than imported, since the original is a local, unexported
 *  function inside MockDraftExperience.tsx. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-surface-raised p-2">
      <p className="font-mono text-[8px] uppercase tracking-widest2 text-ink-tertiary">{label}</p>
      <p className="mt-1 truncate text-xs font-semibold text-ink">{value}</p>
    </div>
  );
}

/**
 * Not a new visual language — every treatment here is lifted directly
 * from ProfileHeader.tsx: the tier-colored rounded-xl photo border,
 * the font-headline score+tier pairing, the bg-void/25 stat-box grid.
 * Reported directly, compared frame-by-frame against both Sleeper's
 * own in-draft card and DD's own profile page — the ask was to match
 * DD's *own* established quality, not invent a generic bordered box
 * for the draft room specifically. DecisionSignals is the exact same
 * component already shipped on the real profile page, rendered here
 * with its own existing styling, not wrapped in an extra box (its
 * border-t/background are already a complete treatment on their own).
 */
export function MockDraftPlayerCard({
  prospect,
  rank,
  score,
  tier,
  tierHitRate,
  communityRank,
  communityDiff,
  qbFormat,
  teFormat,
}: {
  prospect: Prospect;
  rank: number | string;
  score: number | undefined;
  tier: Tier | undefined;
  tierHitRate: number | undefined;
  communityRank: number | undefined;
  communityDiff: number | null;
  qbFormat: MockQBFormat;
  teFormat: MockTEFormat;
}) {
  return (
    <div>
      {/* Rebuilt to genuinely match the real profile page's own
          header — not approximate it with a smaller, generic layout.
          120px photo with the same tier-colored 2px border and school-
          logo badge overlapping the corner (both lifted directly from
          ProfileHeader.tsx, same classes), name in the same headline
          face at a size scaled for this modal's narrower max-w-2xl
          width rather than the full page's own width, and the score
          as its own prominent standalone line below the identity
          block — matching the real page's actual two-part structure
          (identity row, then a separately large score+tier line)
          instead of cramming the score into the same row as the
          photo. */}
      <div className="flex items-start gap-4">
        <div className="relative h-[120px] w-[120px] shrink-0">
          <div className="h-full w-full overflow-hidden rounded-xl border-2 bg-surface" style={{ borderColor: tier ? getTierColor(tier) : "var(--color-border-strong)" }}>
            {prospect.photoUrl ? (
              <Image src={prospect.photoUrl} alt="" width={240} height={240} unoptimized className="h-full w-full object-cover object-top" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-ink-tertiary">{prospect.position}</div>
            )}
          </div>
          {prospect.schoolLogoUrl && (
            <div className="absolute -bottom-1.5 -left-1.5 flex h-8 w-8 items-center justify-center rounded-lg border border-border-strong bg-surface p-1 shadow-sm">
              <Image src={prospect.schoolLogoUrl} alt="" width={32} height={32} unoptimized className="h-full w-full object-contain" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 self-center">
          <h3 className="break-words font-headline text-2xl uppercase leading-[0.95] tracking-tight text-ink sm:text-[28px]">{prospect.name}</h3>
          <p className="mt-1.5 truncate text-xs text-ink-secondary">
            <span className="font-mono font-semibold text-accent">{prospect.position}</span>
            {prospect.school ? ` · ${prospect.school}` : ""}
            {prospect.draftClass ? ` · ${prospect.draftClass}` : ""}
          </p>
          {(prospect.heightIn || prospect.weightLbs) && (
            <p className="mt-0.5 truncate font-data text-xs text-ink-tertiary">
              {prospect.heightIn ? `${Math.floor(prospect.heightIn / 12)}'${prospect.heightIn % 12}"` : ""}
              {prospect.heightIn && prospect.weightLbs ? " · " : ""}
              {prospect.weightLbs ? `${prospect.weightLbs} lbs` : ""}
            </p>
          )}
          <div className="mt-2 flex items-end gap-2">
            <span className="font-headline text-4xl leading-[0.75] tabular-nums" style={{ color: tier ? getTierColor(tier) : undefined }}>
              {score !== undefined ? score.toFixed(1) : "—"}
            </span>
            <span className="pb-1 font-headline text-sm uppercase leading-none" style={{ color: tier ? getTierColor(tier) : undefined }}>
              {tier ?? "—"}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-xl border border-border bg-void/25">
        <div className="p-2.5">
          <p className="font-mono text-[8px] uppercase tracking-widest2 text-ink-tertiary">DD Rank</p>
          <p className="mt-1 font-headline text-xl leading-none tabular-nums text-ink">#{rank}</p>
        </div>
        <div className="border-l border-border p-2.5">
          <p className="font-mono text-[8px] uppercase tracking-widest2 text-ink-tertiary">Tier Hit Rate</p>
          <p className="mt-1 font-headline text-xl leading-none tabular-nums text-ink">{tierHitRate !== undefined ? `${tierHitRate.toFixed(0)}%` : "—"}</p>
        </div>
        <div className="border-l border-border p-2.5">
          <p className="font-mono text-[8px] uppercase tracking-widest2 text-ink-tertiary">Community</p>
          <p className="mt-1 font-headline text-xl leading-none tabular-nums text-ink">
            {communityRank ? `#${communityRank}` : "—"}
            {communityDiff !== null && communityDiff !== 0 && (
              <span className={cn("ml-1 text-xs", communityDiff > 0 ? "text-riser" : "text-faller")}>
                {communityDiff > 0 ? "+" : ""}{communityDiff}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="-mx-5 mt-4 sm:-mx-7">
        <DecisionSignals subScores={prospect.subScores} />
      </div>

      {prospect.subScores?.length ? (
        <div className="mt-4">
          <p className="font-mono text-[9px] font-semibold uppercase tracking-widest2 text-ink-secondary">Subscores</p>
          <div className="mt-2.5 grid grid-cols-4 gap-x-1 gap-y-3 justify-items-center">
            {prospect.subScores.map((sub) => (
              <div key={sub.label} className="w-[52px] shrink-0">
                <ScoreRing
                  label={sub.label}
                  value={sub.value}
                  text={sub.text}
                  size={46}
                  decimals={0}
                  info={subScoreDescription(prospect.position, sub.label)}
                  infoHref={`/methodology#${subScoreSlug(prospect.position, sub.label)}`}
                  color={
                    sub.isPending
                      ? "var(--color-border-strong)"
                      : sub.value === 100
                      ? "#7C3AED"
                      : sub.isElite
                      ? getTierColor("Elite")
                      : sub.value !== undefined
                      ? getTierColor(getTierForScore(sub.value) ?? "Roster Clogger")
                      : getOpportunityColor(prospect.position, sub.text)
                  }
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        // A very early devy prospect can have no computed subscores
        // yet — the same fallback the original panel already showed,
        // preserved here rather than dropped when this was unified
        // into one shared component.
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Stat label="Positional" value={applyFormatAdjustment(prospect.positionalScore, prospect.position, mockLeagueFormat(qbFormat, teFormat))?.toFixed(1) ?? "TBD"} />
          <Stat label="Pre-Draft" value={applyFormatAdjustment(prospect.preDraftScore, prospect.position, mockLeagueFormat(qbFormat, teFormat))?.toFixed(1) ?? "TBD"} />
          <Stat label="Opportunity" value={applyFormatAdjustment(prospect.opportunityScore, prospect.position, mockLeagueFormat(qbFormat, teFormat))?.toFixed(1) ?? "TBD"} />
          <Stat label="Draft Capital" value={prospect.draftProjection?.range ?? "—"} />
        </div>
      )}

      <div className="mt-4 space-y-1.5 text-xs text-ink-secondary">
        <p>
          <span className="text-ink-tertiary">DD vs Community:</span>{" "}
          {communityDiff === null
            ? "Community rank unavailable"
            : communityDiff > 0
            ? `DD ranks him ${communityDiff} spots higher`
            : communityDiff < 0
            ? `Community ranks him ${Math.abs(communityDiff)} spots higher`
            : "Ranks are tied"}
          .
        </p>
        {prospect.draftProjection?.range && <p><span className="text-ink-tertiary">Draft projection:</span> {prospect.draftProjection.range}</p>}
        {prospect.summary && <p className="line-clamp-4"><span className="text-ink-tertiary">Summary:</span> {prospect.summary}</p>}
      </div>
    </div>
  );
}

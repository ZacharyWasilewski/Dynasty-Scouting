"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { User, CheckCircle2, XCircle, Info, ArrowLeft, BookOpen, ArrowRight } from "@/components/ui/SiteIcons";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { TierBadge } from "@/components/rankings/TierBadge";
import { ScoreRing } from "@/components/profile/ScoreRing";
import { GradeDisplay } from "@/components/profile/GradeDisplay";
import { SubScoreRadar } from "@/components/profile/SubScoreRadar";
import { DecisionSignals } from "@/components/profile/DecisionSignals";
import { getTierColor, getTierForScore, getOpportunityColor, qualitativeLabelForPercentile } from "@/lib/tiers";
import { subScoreSlug, subScoreDescription } from "@/lib/methodologySlugs";
import { WatchlistButton } from "@/components/watchlist/WatchlistButton";
import { getGlobalFormat, reportFormatUsed } from "@/lib/globalFormat";
import { applyFormatAdjustment } from "@/lib/formatAdjustment";
import type { Prospect } from "@/types/prospect";
import type { TierHitRateDatum } from "@/lib/analytics";

export function ProfileHeader({
  prospect,
  classRankByFormat,
  positionRankByFormat,
  hitRatesByFormatAndTier,
  watchlistPopularity,
}: {
  prospect: Prospect;
  /** Class Rank / Position Rank precomputed for all 4 league
   *  formats — real, previously-reported bug: these used to always
   *  reflect the 1QB format regardless of the toggle below, so
   *  changing formats would update the DD Score and tier but leave
   *  the rank numbers stale and inconsistent with them. */
  classRankByFormat?: Record<string, { rank: number | undefined; total: number } | undefined>;
  positionRankByFormat?: Record<string, { rank: number | undefined; total: number } | undefined>;
  /** Every tier's historical hit rate for this player's position,
   *  precomputed for all 4 league formats — this component looks up
   *  whichever [format][tier] combination is actually active
   *  (selectedFormat, derived from the toggle below) client-side,
   *  rather than a single value that could go stale or mismatch as
   *  soon as someone changes the format toggle. */
  hitRatesByFormatAndTier: Record<string, TierHitRateDatum[]>;
  /** Null whenever it shouldn't be shown at all — either the
   *  site-wide sample is too small to be meaningful, or this specific
   *  player's own count is too small — see
   *  lib/watchlistPopularity.ts's own thresholds. Never render a "0%"
   *  fallback for null; that would imply a real, checked number
   *  rather than "not enough data yet." */
  watchlistPopularity?: number | null;
}) {
  const [photoFailed, setPhotoFailed] = useState(false);
  // The league-format toggle is read client-side, not server-side —
  // every prospect already has all 4 format variants precomputed
  // (ddScore1QB / ddScoreSuperflex / etc.), so picking between them
  // here never needs a live server round-trip, and critically never
  // forces the page itself into dynamic (per-request) rendering the
  // way reading searchParams in the server component would.
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const formatParam = searchParams.get("format");

  const selectedFormat: "1QB" | "1QB_TEP" | "SUPERFLEX" | "SUPERFLEX_TEP" =
    formatParam === "1qb" ? "1QB" :
    formatParam === "sf" ? "SUPERFLEX" :
    formatParam === "1qb-tep" ? "1QB_TEP" :
    formatParam === "sf-tep" ? "SUPERFLEX_TEP" :
    "SUPERFLEX";

  const ddScore =
    selectedFormat === "1QB" ? prospect.ddScore1QB :
    selectedFormat === "1QB_TEP" ? prospect.ddScore1QBTEP :
    selectedFormat === "SUPERFLEX" ? prospect.ddScoreSuperflex :
    prospect.ddScoreSuperflexTEP;
  const isDrafted = prospect.hasDraftData === true;
  // A devy prospect has no ddScoreXXX yet (that field only exists
  // once someone's actually drafted) — without this fallback, the
  // primary score on the whole page just renders a literal "—" for
  // every undrafted player, a real functional gap, not just a
  // labeling one.
  const isFuture2028 = prospect.draftClass === "2028";
  // 6'2" / 215 lbs — only ever rendered when at least one is present;
  // undefined means neither Sleeper nor ESPN had a value for this
  // specific player, never a placeholder or an estimate.
  const bioLabel =
    prospect.heightIn || prospect.weightLbs
      ? [
          prospect.heightIn ? `${Math.floor(prospect.heightIn / 12)}'${prospect.heightIn % 12}"` : null,
          prospect.weightLbs ? `${prospect.weightLbs} lbs` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : null;
  const displayScore = ddScore ?? (!isDrafted ? applyFormatAdjustment(isFuture2028 ? prospect.rawScore : prospect.preDraftScore, prospect.position, selectedFormat) : undefined);

  // Keep the initial score static, but animate the number whenever the active
  // league format changes it. This makes a format switch feel intentional
  // without replaying the animation on every render.
  const [animatedScore, setAnimatedScore] = useState<number | undefined>(displayScore);
  useEffect(() => {
    if (typeof displayScore !== "number" || !Number.isFinite(displayScore)) {
      setAnimatedScore(displayScore);
      return;
    }

    setAnimatedScore((current) => {
      if (typeof current !== "number" || !Number.isFinite(current) || Math.abs(current - displayScore) < 0.01) return displayScore;
      return current;
    });

    let frame = 0;
    let start: number | null = null;
    const from = typeof animatedScore === "number" && Number.isFinite(animatedScore) ? animatedScore : displayScore;
    const duration = 650;

    const tick = (timestamp: number) => {
      if (start === null) start = timestamp;
      const progress = Math.min(1, (timestamp - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(from + (displayScore - from) * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    if (Math.abs(from - displayScore) >= 0.01) frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayScore]);

  const tierFromField =
    selectedFormat === "1QB" ? prospect.tier1QB :
    selectedFormat === "1QB_TEP" ? prospect.tier1QBTEP :
    selectedFormat === "SUPERFLEX" ? prospect.tierSuperflex :
    prospect.tierSuperflexTEP;
  // Same gap as displayScore above — a devy prospect has no tierXXX
  // field either, so without this fallback the tier badge and the
  // plain-language sentence below both silently disappear for every
  // undrafted player. preDraftScore isn't format-specific (it's a
  // single number regardless of league format), so deriving a tier
  // straight from displayScore here is correct and consistent with
  // how the rest of the site already treats it (see
  // getDisplayedPreDraftScore in lib/prospects.ts).
  const tier = tierFromField ?? (!isDrafted ? getTierForScore(displayScore) : undefined);
  // The one entry from the precomputed 8-tier lookup that actually
  // matches whatever's on screen right now — re-derived here (not
  // just once on mount) so it correctly updates if the format toggle
  // changes which tier applies.
  const tierHitRate = tier ? hitRatesByFormatAndTier[selectedFormat]?.find((t) => t.tier === tier) : undefined;
  const classRank = classRankByFormat?.[selectedFormat];
  const positionRank = positionRankByFormat?.[selectedFormat];
  const hasTierHitRate = tierHitRate?.hitRate !== null && tierHitRate?.hitRate !== undefined && tierHitRate.count > 0;

  const setFormat = (nextFormat: "1QB" | "1QB_TEP" | "SUPERFLEX" | "SUPERFLEX_TEP") => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextFormat === "SUPERFLEX") params.delete("format");
    else if (nextFormat === "1QB") params.set("format", "1qb");
    else if (nextFormat === "1QB_TEP") params.set("format", "1qb-tep");
    else params.set("format", "sf-tep");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    reportFormatUsed(nextFormat);
  };

  // Same sticky cross-page format preference every other listing page
  // uses (lib/globalFormat), applied here only once, right after
  // mount, and only when there's no explicit ?format= in the URL
  // (an incoming link always wins). Deferred to an effect rather than
  // read during the initial render so the very first paint matches
  // what the server rendered — otherwise a Superflex preference would
  // cause a visible hydration flash of mismatched content.
  useEffect(() => {
    if (formatParam) return;
    const preferred = getGlobalFormat();
    if (preferred !== "SUPERFLEX") setFormat(preferred);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isSuperflex = selectedFormat === "SUPERFLEX" || selectedFormat === "SUPERFLEX_TEP";
  const isTEP = selectedFormat === "1QB_TEP" || selectedFormat === "SUPERFLEX_TEP";

  const numericScores = (prospect.subScores ?? [])
    .filter((s): s is { label: string; value: number; text?: string; isElite?: boolean } => s.value !== undefined)
    .map((s) => ({ label: s.label, value: s.value }));

  // Model Summary shows every stage that exists for the player. A 2027/developmental
  // prospect can have both a Raw and a Pre-Draft score, even though the latter
  // is the score currently used for ranking; hiding Raw made the score path
  // look incomplete. Keep the final DD/O.I.S. stages blank until draft data
  // exists rather than copying a pre-draft value under a later-stage label.
  const rankingScoreLabel = isDrafted
    ? "Dynasty Database Score"
    : isFuture2028
      ? "Raw Score"
      : "Pre-Draft Score";

  const rawSummaryScore = !isDrafted
    ? applyFormatAdjustment(prospect.rawScore, prospect.position, selectedFormat)
    : prospect.rawScore;
  const summaryRows = [
    ["Raw Score", rawSummaryScore],
    ["Pre-Draft Score", !isDrafted && !isFuture2028 ? displayScore : (isDrafted ? prospect.preDraftScore : undefined)],
    ["O.I.S. Score", isDrafted ? prospect.opportunityScore : undefined],
    ["Dynasty Database Score", isDrafted ? displayScore : undefined],
  ].map(([label, value]) => ({
    label: String(label),
    value: typeof value === "number" && Number.isFinite(value) ? value : undefined,
    highlighted: String(label) === rankingScoreLabel,
  }));

  return (
    <section className="border-b border-border bg-grid-columns py-3 sm:py-5 lg:py-7">
      <div className="mx-auto w-full max-w-[1840px] px-3 sm:px-5 lg:px-8 xl:px-10">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/players"
            className="flex w-fit items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest2 text-ink-tertiary transition-colors hover:text-accent sm:text-[10px]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {/* Shortened below sm: specifically to give the format
                toggle beside it more breathing room at the narrowest
                supported width (320px) — the two together were only
                about 30px from the edge at that size. "Back" alone
                is still an unambiguous label next to a left-pointing
                arrow. */}
            <span className="sm:hidden">Back</span>
            <span className="hidden sm:inline">Back to Players</span>
          </Link>

          {/* Moved here from inside the identity card, on request —
              sitting between the player's name/school line and the
              score, it read as a control interrupting the two things
              someone actually wants to look at. As a page-level
              utility next to Back to Players (the same category of
              control: "how you're viewing this page," not part of
              the player's own information), the name → score → tier
              reading order underneath is no longer broken up by it. */}
          <div className="flex items-center gap-1.5 md:hidden">
            <div className="inline-flex h-8 shrink-0 border border-border-strong bg-surface p-0.5" role="group" aria-label="League format">
              {(["1QB", "SUPERFLEX"] as const).map((value) => {
                const active = isSuperflex === (value === "SUPERFLEX");
                return <button key={value} type="button" onClick={() => setFormat(value === "SUPERFLEX" ? (isTEP ? "SUPERFLEX_TEP" : "SUPERFLEX") : (isTEP ? "1QB_TEP" : "1QB"))} aria-pressed={active} className={cn("px-2.5 font-mono text-[9px] font-semibold uppercase tracking-[0.16em]", active ? "bg-accent text-white" : "text-ink-secondary hover:text-ink")}>{value === "1QB" ? "1QB" : "Superflex"}</button>;
              })}
            </div>
            <button type="button" onClick={() => setFormat(isSuperflex ? (isTEP ? "SUPERFLEX" : "SUPERFLEX_TEP") : (isTEP ? "1QB" : "1QB_TEP"))} className={cn("h-8 shrink-0 border border-border-strong px-2.5 font-mono text-[9px] font-semibold uppercase tracking-[0.16em]", isTEP ? "bg-accent text-white" : "bg-surface text-ink-secondary")} aria-pressed={isTEP}>TEP</button>
          </div>

          <div className="hidden flex-wrap gap-2 md:flex">
            <div className="inline-flex h-7 border border-border-strong bg-surface p-0.5" role="group" aria-label="League format">
              {(["1QB", "SUPERFLEX"] as const).map((value) => {
                const active = isSuperflex === (value === "SUPERFLEX");
                return <button key={value} type="button" onClick={() => setFormat(value === "SUPERFLEX" ? (isTEP ? "SUPERFLEX_TEP" : "SUPERFLEX") : (isTEP ? "1QB_TEP" : "1QB"))} aria-pressed={active} className={cn("px-2.5 font-mono text-[9px] font-semibold uppercase tracking-[0.16em]", active ? "bg-accent text-white" : "text-ink-secondary hover:text-ink")}>{value === "1QB" ? "1QB" : "Superflex"}</button>;
              })}
            </div>
            <button type="button" onClick={() => setFormat(isSuperflex ? (isTEP ? "SUPERFLEX" : "SUPERFLEX_TEP") : (isTEP ? "1QB" : "1QB_TEP"))} className={cn("h-7 border border-border-strong px-3 font-mono text-[9px] font-semibold uppercase tracking-[0.16em]", isTEP ? "bg-accent text-white" : "bg-surface text-ink-secondary")} aria-pressed={isTEP}>TEP</button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-surface/80 shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
          {/* Dense dossier hero — deliberately capped and grouped like the approved reference. */}
          <div className="grid gap-3 p-4 sm:gap-5 sm:p-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)] lg:gap-8 lg:p-7 xl:p-8">
            {/* Was minmax(500px, ...) — at a real reported width around
                1000-1050px (just past the lg: breakpoint, a genuinely
                awkward zone since desktop layouts are usually tuned
                for much wider viewports), that hard 500px floor forced
                the stat-box column wider than three short, left-
                aligned numbers actually need to look filled — visible
                as real empty space to the right of Tier Hit Rate, not
                inside any single box shrinking. 420px is closer to
                what three compact boxes actually need; the left
                column (photo/name/score) picks up the difference
                instead of losing it to unused whitespace on the right. */}
            {/* 104px, not the original 120px, at the base (mobile)
                size specifically — reclaims 16px for the name column,
                which only has ~160px to work with at the narrowest
                supported width (320px) once card padding and the gap
                are accounted for. A real if modest improvement to how
                often longer names need to wrap; sm: and up keep their
                original, already-comfortable sizes. */}
            {/* 152px at the base (mobile) size, matching what used
                to only kick in at sm: — the photo should have real
                visual presence, not just enough room to avoid
                crowding the name. A previous pass shrank this to
                104px specifically to widen the name column, but that
                traded away the wrong thing: a small photo reads as
                an afterthought. Longer names wrapping to two lines is
                fine and already handled — the line-height on the
                name was fixed for exactly that case — so the name
                column can afford to be narrower again. Using the same
                152px the sm: step already had rather than inventing
                a new one-off size for mobile specifically. */}
            <div className="grid grid-cols-[152px_minmax(0,1fr)] items-start gap-2 max-[374px]:grid-cols-[116px_minmax(0,1fr)] sm:items-center sm:gap-5 lg:grid-cols-[190px_minmax(0,1fr)] lg:gap-6">
              <div className="min-w-0">
                <div className="relative h-[152px] w-[152px] max-[374px]:h-[116px] max-[374px]:w-[116px] lg:h-[190px] lg:w-[190px]">
                  <div className="h-full w-full overflow-hidden rounded-xl border-2 bg-surface" style={{ borderColor: tier ? getTierColor(tier) : "var(--color-border-strong)" }}>
                    {prospect.photoUrl && !photoFailed ? (
                      <Image src={prospect.photoUrl} alt={prospect.name} width={240} height={240} className="h-full w-full object-cover object-top" unoptimized onError={() => setPhotoFailed(true)} />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center"><User className="h-12 w-12 text-ink-tertiary" strokeWidth={1} /></div>
                    )}
                  </div>
                  {prospect.schoolLogoUrl && (
                    <div className="absolute -bottom-2 -left-2 flex h-10 w-10 sm:h-11 sm:w-11 lg:h-12 lg:w-12 items-center justify-center rounded-lg border border-border-strong bg-surface p-1.5 shadow-sm">
                      <Image src={prospect.schoolLogoUrl} alt="" width={40} height={40} unoptimized className="h-full w-full object-contain" />
                    </div>
                  )}
                </div>

              </div>

              <div className="min-w-0 self-start">
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-1">
                  <h1 className="min-w-0 max-w-full break-words font-headline text-[30px] uppercase leading-[0.97] tracking-tight text-ink max-[374px]:text-[26px] sm:text-5xl lg:text-[56px]">
                    {prospect.name}
                  </h1>
                  <WatchlistButton prospectId={prospect.id} className="row-span-2 shrink-0 !m-0 border border-border bg-surface p-1.5 md:row-span-1 md:relative md:ml-auto" iconClassName="h-3.5 w-3.5" />
                  <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-secondary sm:text-sm">
                    <span className="font-mono font-semibold text-accent">{prospect.position}</span><span>·</span><span>{prospect.school ?? "—"}</span>
                    {prospect.draftClass && <><span>·</span><Link href={`/classes/${prospect.draftClass}`} className="font-data hover:text-accent">{prospect.draftClass}</Link></>}
                  </div>
                  {/* Its own line, styled smaller and more muted than
                      the identity row above — crammed onto that same
                      line, this pushed to a second wrapped line at
                      real widths anyway (reported directly: it read
                      as crowded), while competing at the same visual
                      weight as the player's actual identity. Giving
                      it dedicated space with clearly secondary
                      styling reads as supporting detail, not another
                      thing fighting for the same line. */}
                  {bioLabel && <p className="col-span-2 mt-0.5 font-data text-[11px] text-ink-tertiary sm:text-xs">{bioLabel}</p>}
                </div>

                <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1 sm:mt-3">
                  <div className="font-headline text-5xl leading-[0.78] tabular-nums sm:text-6xl" style={{ color: tier ? getTierColor(tier) : undefined }}>{typeof animatedScore === "number" ? animatedScore.toFixed(1) : "—"}</div>
                  <div className="pb-1">
                    <div className="font-headline text-lg uppercase leading-none sm:text-xl" style={{ color: tier ? getTierColor(tier) : undefined }}>{tier ?? "—"}</div>
                    <div className="mt-1 font-mono text-[8px] uppercase tracking-widest2 text-ink-tertiary">{isDrafted ? "Dynasty Database Score" : isFuture2028 ? "Raw Score" : "Pre-Draft Score"}</div>
                  </div>
                </div>

              </div>
            </div>

            <div className="min-w-0 lg:pt-1">
              <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-border bg-void/25">
                <div className="p-3 sm:p-4">
                  <p className="font-mono text-[8px] uppercase tracking-widest2 text-ink-tertiary">Class Rank</p>
                  <p className="mt-1 font-headline text-2xl leading-none tabular-nums text-ink sm:text-3xl">#{classRank?.rank ?? "—"}</p>
                  <p className="mt-1 text-[10px] text-ink-tertiary">1 of {classRank?.total ?? "—"}</p>
                </div>
                <div className="border-l border-border p-3 sm:p-4">
                  <p className="font-mono text-[8px] uppercase tracking-widest2 text-ink-tertiary">Position Rank</p>
                  <p className="mt-1 font-headline text-2xl leading-none text-ink sm:text-3xl">{positionRank?.rank ? `${prospect.position}${positionRank.rank}` : "—"}</p>
                  <p className="mt-1 text-[10px] text-ink-tertiary">{positionRank?.total ?? "—"} in class</p>
                </div>
                <div className="border-l border-border p-3 sm:p-4">
                  <div className="flex items-center gap-1"><p className="font-mono text-[8px] uppercase tracking-widest2 text-ink-tertiary">Tier Hit Rate</p><Info className="h-3 w-3 text-ink-tertiary" /></div>
                  <p className="mt-1 font-headline text-2xl leading-none tabular-nums sm:text-3xl" style={{ color: tier && hasTierHitRate ? getTierColor(tier) : undefined }}>{tier && hasTierHitRate && tierHitRate ? `${Math.round(tierHitRate.hitRate as number)}%` : "—"}</p>
                  <p className="mt-1 text-[10px] text-ink-tertiary">{tier && hasTierHitRate && tierHitRate ? `${Math.round(((tierHitRate.hitRate as number) / 100) * tierHitRate.count)} of ${tierHitRate.count} hit` : "Historical rate"}</p>
                </div>
              </div>
              {(prospect.finish || prospect.hitMiss) && (
                <div className="mt-3 flex items-center justify-between gap-4 rounded-xl border border-border bg-void/20 px-4 py-3">
                  <div><p className="font-mono text-[8px] uppercase tracking-widest2 text-ink-tertiary">Career Outcome</p><div className="mt-1.5">{prospect.finish && <Badge tone="neutral">{prospect.finish}</Badge>}</div></div>
                  {prospect.hitMiss && <span className={cn("flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wide", prospect.hitMiss === "HIT" ? "text-riser" : "text-faller")}>{prospect.hitMiss === "HIT" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}{prospect.hitMiss}</span>}
                </div>
              )}
            </div>
          </div>

          <DecisionSignals subScores={prospect.subScores} />

          <div className="grid grid-cols-4 border-y border-border bg-void/20 text-center">
            {/* Labels are shortened below sm: specifically — "Class
                Progression" and "Similar Prospects" at a genuinely
                readable size in a fixed 4-column mobile grid would
                either wrap unevenly or run into their neighbors,
                exactly what was reported. Short enough to stay on one
                line at a legible size; the full label returns at
                sm: and up, where there's real room for it. */}
            {[
              ["Overview", "Overview", "#overview"],
              ["Progression", "Class Progression", "#class-progression"],
              ["Comps", "Similar Prospects", "#similar-prospects"],
              ["Draft", "Draft Projection", "#draft-projection"],
            ].map(([short, full, href], i) => (
              <a
                key={href}
                href={href}
                className={cn(
                  "flex items-center justify-center px-1 py-4 font-mono text-[10px] uppercase tracking-wide text-ink-tertiary hover:bg-surface hover:text-accent sm:py-2.5 sm:text-[11px] sm:tracking-widest2",
                  i === 0 && "border-b-2 border-accent bg-surface text-accent"
                )}
              >
                <span className="sm:hidden">{short}</span>
                <span className="hidden sm:inline">{full}</span>
              </a>
            ))}
          </div>

          <div id="overview" className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[0.82fr_1.28fr_0.9fr] lg:p-6">
            <div className="rounded-xl border border-border bg-void/15 p-4">
              <div className="mb-3 flex items-center justify-between gap-3"><p className="font-mono text-[9px] font-semibold uppercase tracking-widest2 text-ink-secondary">Prospect Profile</p><span className="font-mono text-[8px] text-ink-tertiary">Percentile · 0–100</span></div>
              {numericScores.length >= 3 ? <div className="flex min-h-[225px] items-center justify-center sm:min-h-[245px]"><SubScoreRadar points={numericScores} position={prospect.position} size={220} color={tier ? getTierColor(tier) : "#2563EB"} /></div> : <div className="flex min-h-[230px] items-center justify-center text-sm text-ink-tertiary">Profile data is still loading.</div>}
            </div>

            <div className="rounded-xl border border-border bg-void/15 p-4">
              <p className="font-mono text-[9px] font-semibold uppercase tracking-widest2 text-ink-secondary">Subscores</p>
              <div className="mt-3 grid gap-x-5 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {prospect.subScores?.map((score) => {
                  const color = score.isPending ? "var(--color-border-strong)" : score.value === 100 ? "#7C3AED" : score.isElite ? getTierColor("Elite") : score.value !== undefined ? getTierColor(getTierForScore(score.value) ?? "Roster Clogger") : getOpportunityColor(prospect.position, score.text);
                  const numeric = score.value !== undefined && !score.isPending;
                  return <div key={score.label} className="flex items-center gap-2 border-b border-border py-2 last:border-b-0"><ScoreRing label="" value={score.value} text={score.text} size={48} decimals={0} info={subScoreDescription(prospect.position, score.label)} infoHref={`/methodology#${subScoreSlug(prospect.position, score.label)}`} color={color} /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><span className="truncate font-mono text-[8px] uppercase tracking-widest2 text-ink-tertiary">{score.label}</span><span className="text-[10px] font-semibold text-ink">{score.isPending ? "TBD" : numeric ? qualitativeLabelForPercentile(score.value as number) : ""}</span></div>{numeric && <div className="mt-1 h-1 bg-border"><div className="h-full" style={{ width: `${score.value}%`, backgroundColor: color }} /></div>}</div></div>;
                })}
              </div>
            </div>

            <div id="model-summary" className="rounded-xl border border-border bg-void/15 p-4">
              <p className="font-mono text-[9px] font-semibold uppercase tracking-widest2 text-ink-secondary">Model Summary</p>
              <div className="mt-3 divide-y divide-border">
                {summaryRows.map(({ label, value, highlighted }, index) => <div key={`${label}-${index}`} className="flex items-center justify-between gap-3 py-3 first:pt-0"><span className={cn("font-mono text-[8px] uppercase tracking-wide", highlighted ? "text-accent" : "text-ink-tertiary")}>{label}</span><span className={cn("font-data text-sm font-semibold tabular-nums", highlighted ? "text-accent" : "text-ink")}>{typeof value === "number" && Number.isFinite(value) ? value.toFixed(1) : "—"}</span></div>)}
              </div>
            </div>
          </div>

          <Link href="/methodology" className="mx-4 mb-4 flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:border-accent/40 sm:mx-5 lg:mx-6 lg:mb-6">
            <BookOpen className="h-4 w-4 shrink-0 text-accent" /><span className="min-w-0 flex-1"><span className="block text-xs font-medium text-ink">What do these scores mean?</span><span className="mt-0.5 block text-[10px] text-ink-tertiary">Learn how we calculate each score and what drives the model.</span></span><ArrowRight className="h-4 w-4 shrink-0 text-accent" />
          </Link>
        </div>
      </div>
    </section>
  );

}

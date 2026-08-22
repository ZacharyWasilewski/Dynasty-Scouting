"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { User, CheckCircle2, XCircle, Info, ArrowLeft, BookOpen, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { TierBadge } from "@/components/rankings/TierBadge";
import { ScoreRing } from "@/components/profile/ScoreRing";
import { GradeDisplay } from "@/components/profile/GradeDisplay";
import { SubScoreRadar } from "@/components/profile/SubScoreRadar";
import { getTierColor, getTierForScore, getOpportunityColor, qualitativeLabelForPercentile } from "@/lib/tiers";
import { subScoreSlug, subScoreDescription } from "@/lib/methodologySlugs";
import { WatchlistButton } from "@/components/watchlist/WatchlistButton";
import { getGlobalFormat, reportFormatUsed } from "@/lib/globalFormat";
import type { Prospect } from "@/types/prospect";
import type { TierHitRateDatum } from "@/lib/analytics";

// Plain-language framing for each tier — see the sentence rendered
// below GradeDisplay for why this exists: a raw number and a tier
// badge don't tell a first-time visitor whether "84" or "Elite" is
// good news without already knowing the model.
const TIER_PLAIN_LANGUAGE: Record<string, string> = {
  Generational: "highest possible",
  Elite: "second-highest",
  Starter: "upper-middle",
  Flex: "middle",
  "Upside Shot": "lower-middle",
  Bench: "below-average",
  "Taxi Squad": "low",
  "Roster Clogger": "lowest",
};

export function ProfileHeader({
  prospect,
  classRankByFormat,
  positionRankByFormat,
  hitRatesByFormatAndTier,
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
    formatParam === "sf" ? "SUPERFLEX" :
    formatParam === "1qb-tep" ? "1QB_TEP" :
    formatParam === "sf-tep" ? "SUPERFLEX_TEP" :
    "1QB";

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
  const displayScore = ddScore ?? (!isDrafted ? prospect.preDraftScore : undefined);
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
    if (nextFormat === "1QB") params.delete("format");
    else if (nextFormat === "SUPERFLEX") params.set("format", "sf");
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
    if (preferred !== "1QB") setFormat(preferred);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isSuperflex = selectedFormat === "SUPERFLEX" || selectedFormat === "SUPERFLEX_TEP";
  const isTEP = selectedFormat === "1QB_TEP" || selectedFormat === "SUPERFLEX_TEP";

  const numericScores = (prospect.subScores ?? [])
    .filter((s): s is { label: string; value: number; text?: string; isElite?: boolean } => s.value !== undefined)
    .map((s) => ({ label: s.label, value: s.value }));

  return (
    <section className="border-b border-border bg-grid-columns">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 lg:px-8 lg:py-12">
        <Link
          href="/players"
          className="flex w-fit items-center gap-1.5 font-mono text-xs uppercase tracking-widest2 text-ink-tertiary transition-colors duration-150 hover:text-accent"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Players
        </Link>
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start">
          {/* Real headshot when one's available (drafted players
              only — see lib/playerPhotos.ts), falling back to the
              same placeholder used everywhere else on the site.
              Rounded-rectangle portrait with the school logo as its
              own small badge, layered overlapping the bottom-left
              corner — replaces the earlier corner-bracket treatment,
              which doesn't really work visually once the photo has
              real rounded corners (a sharp-cornered bracket motif on
              a soft-cornered photo reads as a mismatch, not a style).
              A thin tier-colored ring around the whole photo keeps
              that same "this player's tier, visually attached to
              their photo" idea alive without the brackets. */}
          <div className="relative h-40 w-40 shrink-0 sm:h-48 sm:w-48">
            <div
              className="h-full w-full overflow-hidden rounded-2xl border-2 bg-surface"
              style={{ borderColor: tier ? getTierColor(tier) : "var(--color-border-strong)" }}
            >
              {prospect.photoUrl && !photoFailed ? (
                <Image
                  src={prospect.photoUrl}
                  alt={prospect.name}
                  width={192}
                  height={192}
                  className="h-full w-full object-cover"
                  unoptimized
                  onError={() => setPhotoFailed(true)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <User className="h-16 w-16 text-ink-tertiary" strokeWidth={1} />
                </div>
              )}
            </div>
            {/* The logo badge — its own square, layered to overlap
                the photo's bottom-left corner and extend slightly
                past its edge, not sitting inline in the metadata
                text (see the identity line below, which no longer
                repeats the logo — one clear placement, not two). */}
            {prospect.schoolLogoUrl && (
              <div className="absolute -bottom-3 -left-3 flex h-12 w-12 items-center justify-center rounded-xl border border-border-strong bg-surface p-1.5 shadow-md sm:h-14 sm:w-14">
                {/* Not the shared SchoolLogo component here — that's
                    built for small, inline, text-adjacent usage and
                    wraps itself in its own white circular chip, which
                    would nest awkwardly inside this square badge (a
                    white circle inside a white square is a redundant
                    double background). This badge IS the chip. */}
                <Image
                  src={prospect.schoolLogoUrl}
                  alt=""
                  width={40}
                  height={40}
                  unoptimized
                  className="h-full w-full object-contain"
                />
              </div>
            )}
          </div>

          <div className="flex-1">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="w-full min-w-0 sm:w-auto sm:flex-1">
                <h1 className="font-headline text-4xl uppercase leading-[0.95] tracking-tight text-ink sm:text-6xl">
                  {prospect.name}
                </h1>

                {/* Identity line — position, college (with logo),
                    and draft class all in one line, matching "PLAYER
                    NAME / Position · College · Class" exactly. Class
                    used to live as a separate badge below; folded in
                    here instead since it's part of the same core
                    identity, not a separate fact. */}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-secondary">
                  <span className="font-mono text-sm font-semibold text-accent">
                    {prospect.position}
                  </span>
                  <span aria-hidden="true" className="text-ink-tertiary">·</span>
                  <span className="min-w-0 text-sm">{prospect.school ?? "—"}</span>
                  {prospect.draftClass && (
                    <>
                      <span aria-hidden="true" className="text-ink-tertiary">·</span>
                      <Link
                        href={`/classes/${prospect.draftClass}`}
                        className="text-sm hover:text-accent hover:underline"
                      >
                        {prospect.draftClass}
                      </Link>
                    </>
                  )}
                  <WatchlistButton
                    prospectId={prospect.id}
                    className="shrink-0 border border-border-strong bg-surface p-1.5 hover:border-accent/50"
                    iconClassName="h-3.5 w-3.5"
                  />
                </div>

                {/* Tier and rank badges no longer live here — the
                    tier already appears prominently in the Core
                    Evaluation area below (alongside the score itself,
                    where it means more), and rank has been replaced
                    entirely by the more meaningful Class Rank /
                    Position Rank there too, rather than a
                    database-wide "#N Overall" figure. Career Outcome
                    (an actual real-world result, not a model output)
                    is different enough in kind to keep as its own
                    row. */}

                {/* League-format controls change the calibrated DD Score shown on this profile. */}
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <div className="inline-flex h-9 border border-border-strong bg-surface p-0.5" role="group" aria-label="League format">
                    {(["1QB", "SUPERFLEX"] as const).map((value) => {
                      const active = isSuperflex === (value === "SUPERFLEX");
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setFormat(value === "SUPERFLEX" ? (isTEP ? "SUPERFLEX_TEP" : "SUPERFLEX") : (isTEP ? "1QB_TEP" : "1QB"))}
                          aria-pressed={active}
                          className={cn(
                            "h-full whitespace-nowrap px-3 font-mono text-[10px] font-semibold uppercase tracking-widest2 transition-colors duration-150",
                            active ? "bg-accent text-white" : "text-ink-secondary hover:text-ink"
                          )}
                        >
                          {value === "1QB" ? "1 QB" : "Superflex"}
                        </button>
                      );
                    })}
                  </div>

                  <div className="inline-flex h-9 border border-border-strong bg-surface p-0.5">
                    <button
                      type="button"
                      onClick={() => setFormat(isSuperflex ? (isTEP ? "SUPERFLEX" : "SUPERFLEX_TEP") : (isTEP ? "1QB" : "1QB_TEP"))}
                      aria-pressed={isTEP}
                      className={cn(
                        "h-full whitespace-nowrap px-3 font-mono text-[10px] font-semibold uppercase tracking-widest2 transition-colors duration-150",
                        isTEP ? "bg-accent text-white" : "text-ink-secondary hover:text-ink"
                      )}
                    >
                      TEP
                    </button>
                  </div>
                </div>

                {/* The DD Score (or, for a devy prospect who hasn't
                    been drafted yet, their Pre-Draft Score — see
                    displayScore above) — the primary, cross-position-
                    calibrated rating, and the visual focal point of
                    the whole page. */}
                <div className="mt-5">
                  <GradeDisplay
                    label={isDrafted ? "Dynasty Database Score" : "Pre-Draft Score"}
                    value={displayScore}
                    tierLabel={tier}
                    color={tier ? getTierColor(tier) : undefined}
                    info={
                      isDrafted
                        ? "Dynasty Database Score is the Dynasty Database's primary prospect-quality rating. It converts a player's position-specific model score into a historically calibrated 0–100 score based on the relationship between prospect scores and actual fantasy outcomes."
                        : "Pre-Draft Score is this player's rating before being drafted to the NFL — the moment they're actually drafted, this profile switches over to a full Dynasty Database Score instead, calibrated against real historical outcomes."
                    }
                  />
                  {/* Plain-language framing for anyone landing on a
                      profile page without already knowing what a "84"
                      or "Elite" is supposed to mean — the number and
                      tier badge are precise, but on their own they
                      don't tell a first-time visitor whether that's
                      good news or not. */}
                  {tier && (
                    <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-tertiary">
                      {/* Previously repeated the tier name a second
                          time right here ("Generational is the
                          highest possible tier..."), directly under
                          GradeDisplay's own tier-name line above —
                          visibly redundant on screen, since the tier
                          was already stated once. */}
                      The {TIER_PLAIN_LANGUAGE[tier] ?? "next"} tier in the model.
                    </p>
                  )}
                </div>

                {(prospect.finish || prospect.hitMiss) && (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <span className="font-mono text-xs uppercase tracking-widest2 text-ink-tertiary">
                      Career Outcome
                    </span>
                    {prospect.finish && <Badge tone="neutral">{prospect.finish}</Badge>}
                    {prospect.hitMiss && (
                      <span
                        className={`flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wide ${
                          prospect.hitMiss === "HIT" ? "text-riser" : "text-faller"
                        }`}
                      >
                        {prospect.hitMiss === "HIT" ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5" />
                        )}
                        {prospect.hitMiss}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* CORE EVALUATION SUPPORTING STATS — Class Rank,
                  Position Rank, and Hit Rate at This Tier. Sits where
                  the radar chart used to (that's moved down to be
                  paired with the sub-score breakdown instead, per the
                  "radar + breakdown together" composition) — this is
                  a more meaningful use of that space: real historical
                  context for the score, not a repeat of a visual
                  that appears again further down the page anyway.
                  Compact and secondary by design — the DD Score to
                  the left remains the dominant element on the page,
                  this is supporting context next to it, not a peer. */}
              {(classRank || positionRank || hasTierHitRate) && (
                <div className="flex w-full shrink-0 flex-col gap-5 border-t border-border pt-5 sm:w-auto sm:min-w-[180px] sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
                  {classRank?.rank && (
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary">
                        Class Rank
                      </p>
                      <p className="mt-1 font-headline text-2xl leading-none text-ink">
                        {classRank.rank} <span className="text-base text-ink-tertiary">of {classRank.total}</span>
                      </p>
                    </div>
                  )}
                  {positionRank?.rank && (
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary">
                        Position Rank
                      </p>
                      <p className="mt-1 font-headline text-2xl leading-none text-ink">
                        {prospect.position}
                        {positionRank.rank}
                      </p>
                    </div>
                  )}
                  {hasTierHitRate && tierHitRate && tier && (
                    <div className="group relative">
                      <div className="flex items-center gap-1">
                        <p className="font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary">
                          Hit Rate at This Tier
                        </p>
                        <Info className="h-3 w-3 shrink-0 cursor-help text-ink-tertiary" strokeWidth={2} />
                      </div>
                      <p
                        className="mt-1 font-headline text-2xl leading-none"
                        style={{ color: getTierColor(tier) }}
                      >
                        {Math.round(tierHitRate.hitRate as number)}%
                      </p>
                      <p className="mt-0.5 text-xs text-ink-tertiary">
                        {/* Real bug that shipped: this used to read
                            {tierHitRate.count} of {tierHitRate.total}
                            — but `count` is RESOLVED prospects
                            (hits + misses), not the number of hits,
                            and `total` includes still-unresolved
                            prospects. That produced fractions that
                            mathematically contradicted the
                            percentage above (e.g. "7 of 8" shown next
                            to "100%", when 7/8 is 87.5%). The actual
                            hit count has to be derived from the rate
                            itself, and the denominator has to be the
                            resolved count specifically — total isn't
                            meaningful here since an unresolved
                            prospect hasn't hit OR missed yet. */}
                        {Math.round(((tierHitRate.hitRate as number) / 100) * tierHitRate.count)} of{" "}
                        {tierHitRate.count} {tier} {prospect.position}s hit
                      </p>
                      <div className="pointer-events-none absolute left-0 top-full z-10 mt-2 w-56 border border-border-strong bg-surface p-3 text-xs leading-relaxed text-ink-secondary opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                        Historical hit rate for players at the same position graded in the same Dynasty Database
                        tier.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* PROSPECT PROFILE — the radar chart and the numerical
            breakdown paired together (they're two views of the same
            underlying sub-scores), asymmetrically on desktop rather
            than as two separate, equal-weight blocks: a fixed-size
            visual on one side, the breakdown taking the remaining
            space on the other. Stacked vertically on mobile, radar
            first since it's the faster "shape of this player" read,
            breakdown below for the specific numbers. */}
        {prospect.subScores && prospect.subScores.length > 0 && (
          <div className="mt-4 border-t border-border pt-8">
            <span className="font-mono text-[11px] uppercase tracking-widest2 text-ink-tertiary">
              Prospect Profile
            </span>
            <div className="mt-6 flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-14">
              {numericScores.length >= 3 && (
                <div className="flex justify-center lg:shrink-0 lg:justify-start">
                  <SubScoreRadar
                    points={numericScores}
                    position={prospect.position}
                    size={280}
                    color={tier ? getTierColor(tier) : "#2563EB"}
                  />
                </div>
              )}
              <div className="lg:flex-1">
            {(() => {
              const scores = prospect.subScores!;
              const scoreColor = (s: (typeof scores)[number]) =>
                s.isPending
                  ? "var(--color-border-strong)"
                  : s.value === 100
                  ? "#7C3AED"
                  : s.isElite
                  ? getTierColor("Elite")
                  : s.value !== undefined
                  ? getTierColor(getTierForScore(s.value) ?? "Roster Clogger")
                  : getOpportunityColor(prospect.position, s.text);
              // One unified panel — a single set of dividing lines
              // between rows, not six individually bordered boxes.
              // This replaced an earlier card-grid version (built
              // for a different, since-superseded brief) that was
              // exactly the "information, box, information, box"
              // repetition this current direction explicitly wants
              // removed. Text-based scores (Opportunity's "RB1"
              // style label, not a percentile) skip the qualitative
              // read and bar, since there's no real percentile
              // behind that value to base either on.
              const row = (s: (typeof scores)[number]) => {
                const color = scoreColor(s);
                const isNumeric = s.value !== undefined && !s.isPending;
                return (
                  <div key={s.label} className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
                    <ScoreRing
                      label=""
                      value={s.value}
                      text={s.text}
                      size={56}
                      decimals={0}
                      info={subScoreDescription(prospect.position, s.label)}
                      infoHref={`/methodology#${subScoreSlug(prospect.position, s.label)}`}
                      color={color}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary">
                          {s.label}
                        </p>
                        <p className="shrink-0 text-xs font-semibold text-ink">
                          {s.isPending ? "TBD" : isNumeric ? qualitativeLabelForPercentile(s.value as number) : "\u00A0"}
                        </p>
                      </div>
                      {isNumeric && (
                        <div className="mt-1.5 h-1 w-full bg-border">
                          <div
                            className="h-full transition-all duration-700 ease-out"
                            style={{ width: `${s.value}%`, backgroundColor: color }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              };

              // Single column on mobile (the brief's own priority),
              // but split into two independent divided lists side by
              // side at desktop width — a denser, more efficient use
              // of the extra horizontal space rather than one long
              // narrow column stretched across a wide screen. Each
              // half keeps its own divider lines rather than trying
              // to force one CSS-columns flow to handle dividers
              // correctly across a column break, which gets visually
              // messy.
              const half = Math.ceil(scores.length / 2);
              const firstHalf = scores.slice(0, half);
              const secondHalf = scores.slice(half);

              return (
                <div className="flex flex-col gap-x-10 lg:flex-row">
                  <div className="flex flex-1 flex-col divide-y divide-border">{firstHalf.map(row)}</div>
                  {secondHalf.length > 0 && (
                    <div className="flex flex-1 flex-col divide-y divide-border border-t border-border pt-3.5 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
                      {secondHalf.map(row)}
                    </div>
                  )}
                </div>
              );
            })()}
            <p className="mt-4 whitespace-nowrap font-mono text-[9px] text-ink-tertiary sm:text-[11px]">
              (All scores are percentile based, on a scale of 0-100)
            </p>
              </div>
            </div>
            <Link
              href="/methodology"
              className="mt-8 flex items-center gap-3 border-t border-border pt-5 transition-colors duration-150 hover:text-accent group"
            >
              <BookOpen className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.75} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink">What do these scores mean?</span>
                <span className="mt-0.5 block text-xs text-ink-tertiary">
                  Learn how we calculate each score and what drives the model.
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-accent transition-transform duration-150 group-hover:translate-x-0.5" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

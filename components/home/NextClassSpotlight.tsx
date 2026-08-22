import Link from "next/link";
import Image from "next/image";
import { ArrowRight, User } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { TierBadge } from "@/components/rankings/TierBadge";
import { SchoolLogo } from "@/components/ui/SchoolLogo";
import { getTierColor, getTierForScore } from "@/lib/tiers";
import { getDisplayedPreDraftScore } from "@/lib/prospects";
import type { Prospect } from "@/types/prospect";

/**
 * The single highest-leverage section this homepage was missing —
 * every comparable dynasty analytics site (checked directly:
 * elitedrafters.com leads with exactly this, a featured look at the
 * next class) puts the upcoming class front and center, not buried
 * behind a nav link. Deliberately NOT a copy of that or any other
 * specific site's layout, though — one large featured prospect
 * alongside two smaller ones, rather than either a single hero photo
 * or a row of equal-sized cards. This uses only real, currently-live
 * data — no scripted copy about specific players, since anything
 * specific enough to be worth saying needs to still be true next
 * week when the sheet updates.
 */
export function NextClassSpotlight({ prospects, classYear }: { prospects: Prospect[]; classYear: string }) {
  const top3 = prospects
    .filter((p) => p.draftClass === classYear && p.hasDraftData !== true)
    .map((p) => ({ prospect: p, score: getDisplayedPreDraftScore(p) }))
    .filter((x): x is { prospect: Prospect; score: number } => x.score !== undefined)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (top3.length === 0) return null;

  const [featured, ...runnersUp] = top3;
  // Redundant at runtime (top3 is non-empty here, guaranteed by the
  // length check above) but required to satisfy noUncheckedIndexedAccess
  // — TS can't infer that a destructured first element from a
  // known-non-empty array is defined.
  if (!featured) return null;
  const featuredTier = getTierForScore(featured.score);
  const featuredColor = featuredTier ? getTierColor(featuredTier) : "#2563EB";

  return (
    <section className="border-b border-border bg-surface py-24">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <span className="font-mono text-xs uppercase tracking-widest2 text-accent">
              {classYear} Class — Early Look
            </span>
            <h2 className="mt-3 font-headline text-4xl uppercase leading-[0.95] tracking-tight text-ink sm:text-5xl">
              The next class,
              <br />
              right now.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-ink-secondary">
              The model doesn&apos;t wait for the NFL Draft to start grading — here&apos;s who&apos;s leading the {classYear} class today.
            </p>
          </div>
          <Link
            href={`/classes/${classYear}`}
            className="group flex shrink-0 items-center gap-1.5 font-mono text-xs uppercase tracking-widest2 text-accent hover:underline"
          >
            See the full {classYear} board
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-5">
          {/* Featured #1 — deliberately not the same treatment as the
              two runners-up beside it, or as any player card
              elsewhere on the site: a large circular photo and an
              oversized ghost numeral in the background, reserved for
              exactly this one "this is the headline" moment. */}
          <Link
            href={`/players/${featured.prospect.id}`}
            prefetch={false}
            className="group relative flex flex-col items-center gap-4 overflow-hidden border border-border bg-void p-5 text-center transition-all duration-200 hover:border-accent/40 active:scale-[0.99] sm:flex-row sm:items-center sm:gap-6 sm:p-8 sm:text-left lg:col-span-3"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-4 -top-6 select-none font-headline text-[120px] leading-none text-ink opacity-[0.045] transition-opacity duration-200 group-hover:opacity-[0.07] sm:-right-6 sm:-top-10 sm:text-[220px]"
            >
              01
            </span>
            <div
              className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 sm:h-36 sm:w-36"
              style={{ borderColor: featuredColor }}
            >
              {featured.prospect.photoUrl ? (
                <Image
                  src={featured.prospect.photoUrl}
                  alt=""
                  width={144}
                  height={144}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-surface">
                  <User className="h-12 w-12 text-ink-tertiary" strokeWidth={1} />
                </div>
              )}
            </div>
            {/* min-w-0 so this column can actually shrink within the
                flex row on desktop instead of forcing overflow — the
                exact thing that broke on mobile before this was a
                column (full card width, no competing sibling to
                fight for space with at all). */}
            <div className="relative min-w-0 w-full sm:w-auto">
              <span className="font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary">
                #1 in the class
              </span>
              <p className="mt-1 line-clamp-2 font-headline text-3xl uppercase leading-[0.95] text-ink sm:text-4xl">
                {featured.prospect.name}
              </p>
              <p className="mt-1.5 flex items-center justify-center gap-1 font-mono text-xs text-ink-tertiary sm:justify-start">
                {featured.prospect.position}
                {featured.prospect.school && (
                  <>
                    · <SchoolLogo url={featured.prospect.schoolLogoUrl} size={13} /> {featured.prospect.school}
                  </>
                )}
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
                <span className="font-headline text-4xl sm:text-5xl" style={{ color: featuredColor }}>
                  {featured.score.toFixed(1)}
                </span>
                {featuredTier && <TierBadge tier={featuredTier} perfectScore={featured.score === 100} />}
              </div>
            </div>
          </Link>

          {/* Runners-up — compact, horizontal rows rather than a
              second pair of cards matching the featured one, so the
              size difference itself communicates the ranking instead
              of needing a "#2"/"#3" label to do that work. */}
          <div className="flex flex-col gap-4 lg:col-span-2">
            {runnersUp.map(({ prospect: p, score }, i) => {
              const tier = getTierForScore(score);
              return (
                <Link
                  key={p.id}
                  href={`/players/${p.id}`}
                  prefetch={false}
                  className="group flex flex-1 items-center gap-4 border border-border bg-void p-4 transition-all duration-200 hover:border-accent/40 hover:bg-surface-raised active:scale-[0.98]"
                >
                  <span className="w-6 shrink-0 text-center font-mono text-lg font-bold text-border-strong transition-colors duration-200 group-hover:text-accent/50">
                    {i + 2}
                  </span>
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-border-strong">
                    {p.photoUrl ? (
                      <Image src={p.photoUrl} alt="" width={56} height={56} unoptimized className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-surface">
                        <User className="h-6 w-6 text-ink-tertiary" strokeWidth={1} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-headline text-lg uppercase leading-tight text-ink">{p.name}</p>
                    <p className="mt-0.5 flex items-center gap-1 font-mono text-[11px] text-ink-tertiary">
                      {p.position}
                      {p.school && (
                        <>
                          · <SchoolLogo url={p.schoolLogoUrl} size={10} /> {p.school}
                        </>
                      )}
                    </p>
                  </div>
                  <span
                    className="shrink-0 font-headline text-2xl"
                    style={{ color: tier ? getTierColor(tier) : undefined }}
                  >
                    {score.toFixed(1)}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </Container>
    </section>
  );
}

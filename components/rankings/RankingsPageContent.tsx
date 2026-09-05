"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { RankingsTable } from "@/components/rankings/RankingsTable";
import { getDDTier, type LeagueFormat } from "@/lib/ddScore";
import { TIER_DEFINITIONS } from "@/lib/tiers";
import { cn } from "@/lib/utils";
import type { Prospect } from "@/types/prospect";

/**
 * The "Full Hierarchy" chart used to live entirely in the server
 * page, computed once against a hardcoded 1QB baseline. Two real,
 * reported bugs with that: it never updated when the rankings table
 * below it changed format (a static number sitting above a live
 * one), and it counted undrafted/devy prospects using a tier derived
 * from their Pre-Draft Score — mixed into a chart that's meant to
 * represent the DD Score's own tier distribution specifically,
 * silently corrupting the real shape of that distribution with a
 * different score entirely. Moved here (a client component, in sync
 * with the rankings table's own format toggle via onFormatChange)
 * and restricted to drafted, DD-Score-only prospects — the same fix
 * already applied to the homepage hero for the identical reason.
 */
function tierCountsForFormat(prospects: Prospect[], format: LeagueFormat): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of prospects) {
    if (p.hasDraftData !== true) continue;
    const tier = getDDTier(p, format);
    if (tier) counts[tier] = (counts[tier] ?? 0) + 1;
  }
  return counts;
}

export function RankingsPageContent({ prospects }: { prospects: Prospect[] }) {
  const [format, setFormat] = useState<LeagueFormat>("SUPERFLEX");
  const [hierarchyExpanded, setHierarchyExpanded] = useState(false);
  const handleFormatChange = useCallback((next: LeagueFormat) => setFormat(next), []);

  const tierCounts = tierCountsForFormat(prospects, format);
  const maxCount = Math.max(...TIER_DEFINITIONS.map((t) => tierCounts[t.name] ?? 0));
  const generationalCount = tierCounts["Generational"] ?? 0;

  return (
    <>
      <section className="border-b border-border bg-surface">
        <Container className="flex flex-col gap-8 py-8 sm:py-10 lg:flex-row lg:items-start lg:justify-between">
          <div className="lg:order-2">
            <p className="max-w-xl text-sm leading-relaxed text-ink-secondary">
              Every graded prospect, ranked by Dynasty Database Score.
              {generationalCount > 0 && (
                <>
                  {" "}Only{" "}
                  <Link href="/players?tier=Generational" className="font-semibold text-accent hover:underline">
                    {generationalCount} {generationalCount === 1 ? "has" : "have"} ever cleared a Generational grade
                  </Link>
                  {". It is the rarest tier in the model."}
                </>
              )}
            </p>
          </div>

          {maxCount > 0 && (
            <div className="w-full shrink-0 lg:order-1 lg:w-[42rem] xl:w-[48rem]">
              <button
                type="button"
                onClick={() => setHierarchyExpanded((v) => !v)}
                className="flex w-full items-center justify-between gap-2 lg:pointer-events-none"
              >
                <span className="font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary">
                  The Full Hierarchy
                </span>
                {/* Collapsed by default on mobile only — same reasoning
                    and same "View Full Distribution" pattern already
                    shipped on the class-year pages: 8 full tier rows
                    stacked above the search bar on a page people
                    return to repeatedly is a real, reported cost.
                    lg:hidden removes this toggle affordance entirely
                    at the breakpoint where the chart sits beside the
                    text instead of stacked above the list, so it
                    never costs extra scroll there in the first place. */}
                <span className="font-mono text-[9px] uppercase tracking-widest text-accent lg:hidden">
                  {hierarchyExpanded ? "Hide ↑" : "View Full Distribution ↓"}
                </span>
              </button>
              <div className={cn("mt-3 grid grid-cols-[minmax(0,1fr)_max-content] items-center gap-x-2 gap-y-1.5", !hierarchyExpanded && "hidden lg:grid")}>
                {TIER_DEFINITIONS.map((tier) => {
                  const count = tierCounts[tier.name] ?? 0;
                  const widthPct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                  return (
                    <Link
                      key={tier.name}
                      href={`/players?tier=${encodeURIComponent(tier.name)}`}
                      className="group contents"
                    >
                      <div className="min-w-0">
                        <span
                          className="block h-4 max-w-full transition-[width] duration-300"
                          style={{ width: `${widthPct}%`, backgroundColor: tier.color }}
                        />
                      </div>
                      <span className="whitespace-nowrap font-mono text-[9px] uppercase tracking-wide text-ink-tertiary group-hover:text-ink">
                        {tier.name} ({count})
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </Container>
      </section>

      <section className="bg-void py-10">
        <Container>
          <RankingsTable prospects={prospects} showClassColumn onFormatChange={handleFormatChange} />
        </Container>
      </section>
    </>
  );
}

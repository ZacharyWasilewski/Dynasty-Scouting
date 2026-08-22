import Link from "next/link";
import { BookOpen } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { SectionIntro } from "@/components/layout/SectionIntro";
import { TIER_DEFINITIONS } from "@/lib/tiers";

export const metadata = {
  title: "Glossary — Dynasty Database",
  description: "Quick definitions for the terms used across Dynasty Database.",
};

// Descriptive text only — name/min/color come from TIER_DEFINITIONS
// (lib/tiers.ts) directly, matched up below by tier name. This used
// to be a second, fully hardcoded copy of the tier list, which meant
// a real threshold or color change in lib/tiers.ts would silently
// never reach this page.
const TIER_BLURBS: Record<string, string> = {
  Generational: "The rarest grade on the site — a truly elite prospect.",
  Elite: "A clear top-tier prospect, just short of Generational.",
  Starter: "Model expects a legitimate NFL starter.",
  Flex: "The middle of the pack — a solid depth/flex-level outcome.",
  "Upside Shot": "Lower floor, but real athletic or situational upside.",
  Bench: "Likely a rotational or backup-caliber player.",
  "Taxi Squad": "Long-shot outcome — worth a deep stash, not much more.",
  "Roster Clogger": "Model doesn't project a meaningful NFL role.",
};

const TERMS: { term: string; blurb: string }[] = [
  {
    term: "DD Score",
    blurb:
      "The site's primary 0–100 grade for a drafted player. Once someone's actually been drafted, this is the number that matters — it's calibrated against real historical outcomes, not just measurables or draft capital.",
  },
  {
    term: "Pre-Draft Score",
    blurb:
      "The equivalent grade for a devy prospect who hasn't been drafted yet. Every profile switches from this to a real DD Score the moment a player is actually drafted — they're not two competing systems, just two stages of the same one.",
  },
  {
    term: "Positional Score",
    blurb: "A player's grade measured only against others at the same position, not the whole class.",
  },
  {
    term: "Tier",
    blurb: "A plain-language label attached to a DD Score/Pre-Draft Score range — see the full list below.",
  },
  {
    term: "Community Rank",
    blurb: "An alternate ranking sourced from FantasyCalc's crowd-sourced dynasty values, shown for comparison alongside the model's own rank.",
  },
  {
    term: "Team Sync Grade",
    blurb:
      "A letter grade for your whole synced roster — total dynasty value (every rostered player plus your owned draft picks), ranked against the real teams in your actual league. The 50th percentile lands in the C range, since it's relative to your league, not an absolute score.",
  },
  {
    term: "Need (Team Sync)",
    blurb: "A position where your synced team ranks below the 66th percentile in its own league — genuinely thin, not just \"below average.\"",
  },
  {
    term: "Pick Tier (Early / Mid / Late)",
    blurb:
      "Within a draft round, which third of the league a pick falls in, based on whoever's record actually determines that pick's slot — a league's worst team owns the Early picks that round.",
  },
];

export default function GlossaryPage() {
  return (
    <main>
      <SectionIntro
        icon={BookOpen}
        eyebrow="Reference"
        title="Glossary"
        description="Quick definitions for the terms used across the site — for a full breakdown of how the model actually works, see the Methodology page."
      >
        <Link href="/methodology" className="mt-4 inline-block font-mono text-xs text-accent hover:underline">
          Read the full methodology →
        </Link>
      </SectionIntro>

      <section className="py-14">
        <Container className="max-w-2xl">
          <div className="flex flex-col divide-y divide-border border border-border">
            {TERMS.map((t) => (
              <div key={t.term} className="px-5 py-4">
                <p className="font-display text-base font-semibold text-ink">{t.term}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-secondary">{t.blurb}</p>
              </div>
            ))}
          </div>

          <h2 className="mt-12 font-display text-xl font-semibold text-ink">The 8 tiers</h2>
          <p className="mt-2 text-sm text-ink-tertiary">Highest to lowest — every tier badge on the site uses these same colors.</p>

          {/* Same proportional spectrum device used on the homepage
              — reused rather than re-invented, and pulling directly
              from TIER_DEFINITIONS rather than a second hardcoded
              copy of it. */}
          <div className="mt-4 flex h-10 w-full overflow-hidden">
            {TIER_DEFINITIONS.map((tier, i) => {
              const max = i === 0 ? 100 : TIER_DEFINITIONS[i - 1]!.min;
              return (
                <div
                  key={tier.name}
                  className="h-full"
                  style={{ flexGrow: max - tier.min, flexBasis: 0, backgroundColor: tier.color }}
                  title={`${tier.name} — ${tier.min}+`}
                />
              );
            })}
          </div>

          <div className="mt-4 flex flex-col divide-y divide-border border border-border">
            {TIER_DEFINITIONS.map((t) => (
              <div key={t.name} className="flex items-center gap-3 px-5 py-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: t.color }} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold" style={{ color: t.color }}>{t.name} <span className="font-mono text-xs text-ink-tertiary">{t.min}+</span></p>
                  <p className="mt-0.5 text-xs text-ink-tertiary">{TIER_BLURBS[t.name]}</p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>
    </main>
  );
}

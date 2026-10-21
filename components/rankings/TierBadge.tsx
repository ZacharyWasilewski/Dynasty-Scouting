import Link from "next/link";
import { getTierColor } from "@/lib/tiers";
import type { Tier } from "@/types/prospect";

export function TierBadge({
  tier,
  href,
  perfectScore,
}: {
  tier: Tier;
  href?: string;
  /** A perfect 100 score gets a gold outline on top of its normal
   *  tier color/label — still the same tier, just visually marked
   *  as the very best of it. */
  perfectScore?: boolean;
}) {
  const color = getTierColor(tier);
  const gold = perfectScore && tier === "Generational";
  const className =
    "inline-flex w-fit items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide";
  const style = {
    color,
    borderColor: gold ? "#FACC15" : `${color}4D`,
    backgroundColor: `${color}1A`,
    boxShadow: gold ? "0 0 0 1px #FACC15" : undefined,
  };

  if (href) {
    return (
      <Link href={href} className={`${className} transition-opacity duration-150 hover:opacity-80`} style={style}>
        {tier}
      </Link>
    );
  }

  return (
    <span className={className} style={style}>
      {tier}
    </span>
  );
}

import Link from "next/link";
import { getTierColor } from "@/lib/tiers";
import type { Tier } from "@/types/prospect";

export function TierBadge({ tier, href }: { tier: Tier; href?: string }) {
  const color = getTierColor(tier);
  const className =
    "inline-flex w-fit items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide";
  const style = {
    color,
    borderColor: `${color}4D`,
    backgroundColor: `${color}1A`,
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

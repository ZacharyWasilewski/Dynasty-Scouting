import Link from "next/link";
import { User } from "lucide-react";
import { TierBadge } from "@/components/rankings/TierBadge";
import type { Prospect } from "@/types/prospect";
import type { PositionTheme } from "@/lib/positionThemes";

export function PlayerCard({
  prospect,
  theme,
}: {
  prospect: Prospect;
  theme: PositionTheme;
}) {
  return (
    <Link
      href={`/players/${prospect.id}`}
      className="group block border border-border bg-surface transition-all duration-200 ease-out hover:-translate-y-1 hover:border-border-strong"
    >
      <div className="h-1 w-full transition-all duration-200" style={{ backgroundColor: theme.accent }} />
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex h-14 w-14 items-center justify-center border border-border-strong bg-surface-raised transition-transform duration-200 group-hover:scale-105">
            <User className="h-6 w-6 text-ink-tertiary" strokeWidth={1.25} />
          </div>
          <span className="font-mono text-xs text-ink-tertiary">
            {prospect.rank ? `#${prospect.rank}` : "—"}
          </span>
        </div>

        <h3 className="mt-4 font-display text-lg font-semibold text-ink transition-colors duration-200 group-hover:text-accent">
          {prospect.name}
        </h3>
        <p className="mt-0.5 text-xs text-ink-tertiary">{prospect.school ?? "—"}</p>

        <div className="mt-5 flex items-end justify-between">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary">
              Score
            </span>
            <p
              className="font-mono text-2xl font-semibold"
              style={{
                color: prospect.grade?.overall !== undefined ? theme.accent : undefined,
              }}
            >
              {prospect.grade?.overall?.toFixed(1) ?? (prospect.preDraftScore !== undefined ? "TBD" : "—")}
            </p>
          </div>
          {prospect.tier && <TierBadge tier={prospect.tier} />}
        </div>
      </div>
    </Link>
  );
}

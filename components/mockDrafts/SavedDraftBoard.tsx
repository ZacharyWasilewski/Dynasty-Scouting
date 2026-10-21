import Link from "next/link";
import Image from "next/image";
import { formatPick } from "@/lib/mockDraft";
import { playerHref } from "@/lib/playerLinks";
import { POSITION_CLASS } from "@/lib/mockDraftFormat";
import { getTierColor } from "@/lib/tiers";
import { cn } from "@/lib/utils";
import type { LeagueFormat } from "@/lib/ddScore";
import type { Tier } from "@/types/prospect";

export interface SavedBoardPick {
  overall: number;
  playerId: string;
  playerName: string;
  position: string;
  userPick: boolean;
  score: number | null;
  tier?: Tier | null;
  photoUrl?: string;
  scoreLabel?: string;
}

export function SavedDraftBoard({ picks, teams, slot, format }: { picks?: SavedBoardPick[]; teams: number; slot?: number; format: LeagueFormat }) {
  if (!Array.isArray(picks) || !picks.length) return <p className="mt-4 text-xs text-ink-tertiary">This older draft contains your selections only; a full-room snapshot was not recorded.</p>;
  const byOverall = new Map(picks.map(pick => [pick.overall, pick]));
  const rounds = Math.ceil(Math.max(...picks.map(pick => pick.overall)) / teams);
  return (
    <details className="mt-5 min-w-0 border border-border bg-surface p-4">
      <summary className="cursor-pointer font-headline text-sm uppercase">Full draft board · {picks.length} picks</summary>
      <p className="my-3 text-xs text-ink-tertiary">Saved at draft time. Your selections are highlighted. Scroll across to see every team.</p>
      <div role="region" aria-label="Saved draft board, scroll horizontally to see all teams" tabIndex={0} className="max-w-full overflow-x-auto overscroll-x-contain border border-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
        <table className="w-max table-fixed border-collapse text-left" style={{ width: `calc(${teams} * var(--mock-col-width))` }}>
          <caption className="sr-only">Completed draft: {teams} teams, {rounds} rounds. Columns are teams; rows are rounds.</caption>
          <thead>
            <tr>{Array.from({ length: teams }, (_, i) => i + 1).map(team => (
              <th scope="col" key={team} className={cn("border-b border-r border-border px-1.5 py-2 text-[10px] font-semibold", team === slot ? "bg-accent/10 text-accent" : "bg-surface-raised text-ink-secondary")} style={{ width: "var(--mock-col-width)" }}>
                Team {team}{team === slot ? " · You" : ""}
              </th>
            ))}</tr>
          </thead>
          <tbody>{Array.from({ length: rounds }, (_, round) => (
            <tr key={round}>{Array.from({ length: teams }, (_, column) => {
              const overall = round * teams + column + 1;
              const pick = byOverall.get(overall);
              return (
                <td key={overall} className={cn("border-b border-r border-border p-0 align-top", pick?.userPick ? "bg-accent/10" : round % 2 ? "bg-void/[0.025]" : "bg-surface")}>
                  {pick ? <Link href={playerHref(pick.playerId, format)} aria-label={`${formatPick(overall, teams)}, ${pick.playerName}, ${pick.position}${pick.userPick ? ", your pick" : ""}`} className="block h-full min-h-[104px] border-l-[3px] border-transparent p-1.5 hover:bg-surface-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent" style={pick.tier ? { borderLeftColor: getTierColor(pick.tier) } : undefined}>
                    <div className="flex items-center justify-between gap-1">
                      <span className={cn("border px-1 py-0.5 font-mono text-[8px] font-semibold", POSITION_CLASS[pick.position])}>{pick.position}</span>
                      <span className="font-mono text-[9px] text-ink-tertiary">{formatPick(overall, teams)}</span>
                    </div>
                    <div className="mt-2 flex items-start gap-1">
                      <span className="min-w-0 flex-1 break-words text-[11px] font-semibold leading-tight">{pick.playerName}</span>
                      {pick.photoUrl && <Image src={pick.photoUrl} alt="" width={24} height={24} unoptimized className="h-6 w-6 shrink-0 rounded-full object-cover" />}
                    </div>
                    <p className="mt-1 text-[10px] font-semibold" style={pick.tier ? { color: getTierColor(pick.tier) } : undefined}>{pick.scoreLabel ?? "Score"} {pick.score?.toFixed(1) ?? "TBD"}</p>
                    {pick.userPick && <span className="text-[9px] font-semibold text-accent">Your pick</span>}
                  </Link> : <span className="block min-h-[104px] p-2 text-[10px] text-ink-tertiary">{formatPick(overall, teams)} · Not recorded</span>}
                </td>
              );
            })}</tr>
          ))}</tbody>
        </table>
      </div>
    </details>
  );
}

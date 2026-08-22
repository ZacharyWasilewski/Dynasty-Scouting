"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Search, ArrowLeft, AlertTriangle, LogIn, Trash2 } from "lucide-react";
import { cn, ordinalSuffix } from "@/lib/utils";
import { track } from "@/lib/track";
import { SchoolLogo } from "@/components/ui/SchoolLogo";
import { getTierColor } from "@/lib/tiers";
import { GradeDisplay } from "@/components/profile/GradeDisplay";
import { getScoreForFormat, getTierForFormat, type MockQBFormat } from "@/lib/mockDraft";
import { useAuth } from "@/components/auth/AuthProvider";
import type { Prospect, Position } from "@/types/prospect";

interface LeagueSummary {
  leagueId: string;
  name: string;
  season: string;
}

interface TeamSummary {
  rosterId: number;
  teamName: string;
}

interface SavedTeam {
  id: string;
  leagueId: string;
  rosterId: number;
  leagueName: string;
  teamName: string;
}

interface PositionNeed {
  position: Position;
  rosteredCount: number;
  totalValue: number;
  leagueAvgValue: number;
  percentile: number;
  needScore: number;
}

interface NeedsResult {
  leagueName: string;
  teamName: string;
  format: MockQBFormat;
  teFormat: "STANDARD" | "TEP";
  needs: PositionNeed[];
  recommendations: { position: Position; need: PositionNeed; prospects: Prospect[] }[];
  overallGrade: { grade: string; percentile: number };
  moversAtNeeds: { id: string; name: string; position: string; school?: string; schoolLogoUrl?: string; score: number; delta: number }[];
  pickValue: number;
  pickPercentile: number;
}

type Step =
  | { kind: "start" }
  | { kind: "userLeagues"; leagues: LeagueSummary[] }
  | { kind: "teams"; leagueId: string; leagueName: string; teams: TeamSummary[] }
  | { kind: "results"; result: NeedsResult };

const POSITION_DOT: Record<string, string> = {
  QB: "bg-[#2563EB]",
  RB: "bg-[#16A34A]",
  WR: "bg-[#0EA5E9]",
  TE: "bg-[#A855F7]",
};

// Same color intent as the DD Score tier palette (purple → blue →
// green → yellow → orange → red), applied to letter grades instead
// of tier names so the overall grade reads with the same "temperature"
// language as everything else on the site at a glance.
//
// B and C+ specifically were adjusted from their original values —
// the old B (#86EFAC, a pale mint green) and C+ (#EAB308, a bright
// yellow) were tuned to glow nicely against near-black, but read as
// low-contrast, hard-to-read text directly on the new light
// background. Every other value here already had enough saturation
// to work as real text on white without changing.
const GRADE_COLORS: Record<string, string> = {
  "A+": "#7C3AED",
  A: "#2563EB",
  "B+": "#16A34A",
  B: "#3F8F5F",
  "C+": "#CA8A04",
  C: "#FB923C",
  "D+": "#EA580C",
  D: "#EA580C",
  F: "#DC2626",
};

/**
 * Translates the whole page into one sentence — the actual fix for
 * "there's no quick way to know if a B+ is good": everything below
 * this (the positional grid, picks, movers, recommendations) is real
 * supporting detail, but most people won't read all of it every
 * time. This is what someone gets even if they read nothing else.
 */
function buildSummarySentence(needs: NeedsResult["needs"], pickPercentile: number): string {
  const stocked = needs.filter((n) => n.percentile >= 66).map((n) => n.position);
  const thin = needs.filter((n) => n.needScore > 0).sort((a, b) => a.percentile - b.percentile).map((n) => n.position);

  const parts: string[] = [];
  if (stocked.length > 0) parts.push(`Strong at ${stocked.join(" and ")}`);
  if (thin.length > 0) parts.push(`thin at ${thin.slice(0, 2).join(" and ")}`);
  const positionClause = parts.length > 0 ? parts.join(", ") : "Balanced across every skill position";

  const pickClause =
    pickPercentile >= 66
      ? "your rookie pick capital is above average"
      : pickPercentile < 34
      ? "your rookie pick capital is thin"
      : "your rookie pick capital is roughly average";

  return `${positionClause} — and ${pickClause}.`;
}

export function TeamSyncContent() {
  const { user, loading: authLoading } = useAuth();
  const [step, setStep] = useState<Step>({ kind: "start" });
  const [mode, setMode] = useState<"leagueId" | "username">("leagueId");
  const [leagueIdInput, setLeagueIdInput] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedTeams, setSavedTeams] = useState<SavedTeam[] | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch("/api/sleeper?action=saved")
      .then((res) => res.json())
      .then((data) => setSavedTeams(data.teams ?? []))
      .catch(() => setSavedTeams([]));
  }, [user]);

  if (authLoading) {
    return <div className="h-24" />;
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center gap-3 border border-border bg-surface px-6 py-16 text-center">
        <LogIn className="h-6 w-6 text-ink-tertiary" strokeWidth={1.5} />
        <p className="text-sm font-medium text-ink-secondary">Log in to sync your Sleeper league.</p>
        <Link
          href={`/login?redirect=${encodeURIComponent("/team-sync")}`}
          className="mt-1 font-mono text-xs text-accent hover:underline"
        >
          Log in
        </Link>
      </div>
    );
  }

  async function loadTeams(leagueId: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sleeper?action=teams&leagueId=${encodeURIComponent(leagueId)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setStep({ kind: "teams", leagueId: data.leagueId, leagueName: data.leagueName, teams: data.teams });
    } catch {
      setError("Couldn't reach Sleeper. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  async function submitLeagueId(e: React.FormEvent) {
    e.preventDefault();
    if (!leagueIdInput.trim()) return;
    await loadTeams(leagueIdInput.trim());
  }

  async function submitUsername(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sleeper?action=leagues&username=${encodeURIComponent(username.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      if (!data.leagues.length) {
        setError(`No leagues found for "${username}" this season.`);
        return;
      }
      setStep({ kind: "userLeagues", leagues: data.leagues });
    } catch {
      setError("Couldn't reach Sleeper. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  async function loadNeeds(leagueId: string, rosterId: number) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sleeper?action=needs&leagueId=${leagueId}&rosterId=${rosterId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setStep({ kind: "results", result: data });
      track("team_synced", "/team-sync");
      // Persisted to the account, not the browser — this is what
      // makes the sync survive a page reload/new device, and is also
      // what Mock Draft reads to know which team to suggest against.
      fetch("/api/sleeper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueId, rosterId, leagueName: data.leagueName, teamName: data.teamName }),
      })
        .then((r) => r.json())
        .then(() => fetch("/api/sleeper?action=saved").then((r) => r.json()).then((d) => setSavedTeams(d.teams ?? [])))
        .catch(() => {});
    } catch {
      setError("Couldn't reach Sleeper. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  async function removeSavedTeam(id: string) {
    setRemovingId(id);
    try {
      await fetch(`/api/sleeper?id=${id}`, { method: "DELETE" });
      setSavedTeams((prev) => prev?.filter((t) => t.id !== id) ?? null);
    } finally {
      setRemovingId(null);
    }
  }

  function reset() {
    setStep({ kind: "start" });
    setError(null);
  }

  if (step.kind === "start") {
    return (
      <div className="max-w-md">
        {savedTeams && savedTeams.length > 0 && (
          <div className="mb-6">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary">
              Your synced teams
            </p>
            <div className="border border-border bg-surface">
              {savedTeams.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-2 border-b border-border px-4 py-3 last:border-0"
                >
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => loadNeeds(t.leagueId, t.rosterId)}
                    className="min-w-0 flex-1 text-left disabled:opacity-50"
                  >
                    <p className="truncate text-sm font-medium text-ink">{t.teamName}</p>
                    <p className="truncate font-mono text-[10px] text-ink-tertiary">{t.leagueName}</p>
                  </button>
                  <button
                    type="button"
                    disabled={removingId === t.id}
                    onClick={() => removeSavedTeam(t.id)}
                    aria-label={`Remove ${t.teamName}`}
                    className="shrink-0 p-1.5 text-ink-tertiary transition-colors duration-150 hover:text-faller disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary">
              Sync another league
            </p>
          </div>
        )}

        <div className="mb-4 inline-flex h-9 border border-border-strong bg-surface p-0.5">
          {(["leagueId", "username"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={cn(
                "h-full px-3 font-mono text-[10px] font-semibold uppercase tracking-widest2 transition-colors duration-150",
                mode === m ? "bg-accent text-white" : "text-ink-secondary hover:text-ink"
              )}
            >
              {m === "leagueId" ? "League ID" : "Username"}
            </button>
          ))}
        </div>

        {mode === "leagueId" ? (
          <>
            <form onSubmit={submitLeagueId} className="flex gap-2">
              <input
                value={leagueIdInput}
                onChange={(e) => setLeagueIdInput(e.target.value)}
                placeholder="Sleeper league ID"
                className="min-w-0 flex-1 border border-border-strong bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-tertiary focus:border-accent focus:outline-none"
              />
              <button
                type="submit"
                disabled={loading}
                className="flex shrink-0 items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-accent-dim disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Go
              </button>
            </form>
            <p className="mt-3 text-xs text-ink-tertiary">
              Find this in the Sleeper app under your league&apos;s settings, or in the URL when you&apos;re viewing
              your league on sleeper.com — it&apos;s the long number after{" "}
              <span className="text-ink-secondary">/leagues/</span>. This is more reliable than a username, since it
              points straight at the league instead of requiring your exact login username.
            </p>
          </>
        ) : (
          <>
            <form onSubmit={submitUsername} className="flex gap-2">
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Your Sleeper username"
                className="min-w-0 flex-1 border border-border-strong bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-tertiary focus:border-accent focus:outline-none"
              />
              <button
                type="submit"
                disabled={loading}
                className="flex shrink-0 items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-accent-dim disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Find leagues
              </button>
            </form>
            <p className="mt-3 text-xs text-ink-tertiary">
              This is your Sleeper login username, not a display/team name — if you&apos;re not sure, use your League
              ID instead. Nothing gets written back to Sleeper; this only reads public league info.
            </p>
          </>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-2 border border-faller/30 bg-faller/10 px-3 py-2.5 text-xs text-faller">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}
      </div>
    );
  }

  if (step.kind === "userLeagues") {
    return (
      <div className="max-w-md">
        <button type="button" onClick={reset} className="mb-4 flex items-center gap-1.5 text-xs text-ink-tertiary hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary">Pick a league</p>
        <div className="border border-border bg-surface">
          {step.leagues.map((l) => (
            <button
              key={l.leagueId}
              type="button"
              disabled={loading}
              onClick={() => loadTeams(l.leagueId)}
              className="flex w-full items-center justify-between gap-3 border-b border-border px-4 py-3 text-left text-sm text-ink last:border-0 transition-colors duration-150 hover:bg-surface-raised/70 active:bg-surface-raised/70 disabled:opacity-50 disabled:active:bg-transparent"
            >
              <span className="font-medium">{l.name}</span>
              <span className="font-mono text-[10px] text-ink-tertiary">{l.season}</span>
            </button>
          ))}
        </div>
        {loading && (
          <div className="mt-4 flex items-center gap-2 text-xs text-ink-secondary">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading teams…
          </div>
        )}
        {error && (
          <div className="mt-4 flex items-start gap-2 border border-faller/30 bg-faller/10 px-3 py-2.5 text-xs text-faller">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}
      </div>
    );
  }

  if (step.kind === "teams") {
    return (
      <div className="max-w-md">
        <button type="button" onClick={reset} className="mb-4 flex items-center gap-1.5 text-xs text-ink-tertiary hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary">
          Which team is yours in {step.leagueName}?
        </p>
        <div className="border border-border bg-surface">
          {step.teams.map((t) => (
            <button
              key={t.rosterId}
              type="button"
              disabled={loading}
              onClick={() => loadNeeds(step.leagueId, t.rosterId)}
              className="flex w-full items-center border-b border-border px-4 py-3 text-left text-sm font-medium text-ink last:border-0 transition-colors duration-150 hover:bg-surface-raised/70 active:bg-surface-raised/70 disabled:opacity-50 disabled:active:bg-transparent"
            >
              {t.teamName}
            </button>
          ))}
        </div>
        {loading && (
          <div className="mt-4 flex items-center gap-2 text-xs text-ink-secondary">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Pulling your roster…
          </div>
        )}
        {error && (
          <div className="mt-4 flex items-start gap-2 border border-faller/30 bg-faller/10 px-3 py-2.5 text-xs text-faller">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}
      </div>
    );
  }

  const { result } = step;
  const topNeeds = result.needs.filter((n) => n.needScore > 0);

  return (
    <div>
      <button type="button" onClick={reset} className="mb-6 flex items-center gap-1.5 text-xs text-ink-tertiary hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Sync a different league
      </button>

      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-xl font-semibold text-ink">{result.teamName}</h2>
        <span className="font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary">
          {result.leagueName}
        </span>
        <span className="ml-auto rounded-full border border-border-strong px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest2 text-ink-secondary">
          {result.format === "SUPERFLEX" ? "Superflex" : "1 QB"}
          {result.teFormat === "TEP" ? " · TE+" : ""}
        </span>
      </div>

      <div className="mt-6 border border-border bg-surface p-5">
        <GradeDisplay
          label="Overall Team Grade"
          text={result.overallGrade.grade}
          color={GRADE_COLORS[result.overallGrade.grade]}
          info="Your team's total dynasty value — every rostered player at QB/RB/WR/TE plus your owned 2027/2028 draft picks — percentile-ranked against every other real team in this league. The 50th percentile (a perfectly average team) lands in the C range, since this is relative to your league-mates, not an absolute score."
        />
        <p className="mt-1 font-mono text-[10px] text-ink-tertiary">
          {ordinalSuffix(result.overallGrade.percentile)} percentile total value, roster + picks, vs. this league
        </p>
        <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
          {buildSummarySentence(result.needs, result.pickPercentile)}
        </p>
      </div>

      <p className="mt-3 text-xs text-ink-tertiary">
        Synced — <Link href="/mock-draft" className="text-accent hover:underline">Mock Draft</Link> will now flag
        picks at your needs with a Suggested tab.
      </p>

      <div className="mt-8 flex items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary">The Details</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="mt-4 border border-border bg-surface p-4">
        <p className="font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary">
          Positional value — vs. this league
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {result.needs.map((n) => (
            <div key={n.position} className="border border-border-strong bg-surface-raised p-3">
              <div className="flex items-center gap-1.5">
                <span className={cn("h-1.5 w-1.5 rounded-full", POSITION_DOT[n.position])} />
                <span className="font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary">
                  {n.position}
                </span>
              </div>
              <p className="mt-1.5 text-lg font-semibold text-ink">
                {ordinalSuffix(n.percentile)}
                <span className="ml-1 text-xs font-normal text-ink-tertiary">pctl</span>
              </p>
              <p className="mt-0.5 font-mono text-[9px] text-ink-tertiary">
                {n.totalValue.toLocaleString()} val · lg avg {n.leagueAvgValue.toLocaleString()} · {n.rosteredCount} rostered
              </p>
              {n.needScore > 0 ? (
                <p className="mt-1 font-mono text-[9px] uppercase tracking-widest2 text-faller">Need</p>
              ) : (
                <p className="mt-1 font-mono text-[9px] uppercase tracking-widest2 text-riser">Stocked</p>
              )}
            </div>
          ))}
          <div className="col-span-2 border border-border-strong bg-surface-raised p-3 sm:col-span-1">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#F59E0B]" />
              <span className="font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary">Picks</span>
            </div>
            <p className="mt-1.5 text-lg font-semibold text-ink">
              {ordinalSuffix(result.pickPercentile)}
              <span className="ml-1 text-xs font-normal text-ink-tertiary">pctl</span>
            </p>
            <p className="mt-0.5 font-mono text-[9px] text-ink-tertiary">
              {result.pickValue.toLocaleString()} val · 2027–28, rds 1–4
            </p>
            {result.pickPercentile < 50 ? (
              <p className="mt-1 font-mono text-[9px] uppercase tracking-widest2 text-faller">Below avg</p>
            ) : (
              <p className="mt-1 font-mono text-[9px] uppercase tracking-widest2 text-riser">Above avg</p>
            )}
          </div>
        </div>
      </div>

      {result.moversAtNeeds.length > 0 && (
        <div className="mt-6 border border-border bg-surface p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary">
            Movers at your needs
          </p>
          <p className="mt-1 text-xs text-ink-tertiary">
            Devy prospects whose Pre-Draft Score has moved recently, at a position you actually need.
          </p>
          <div className="mt-3 flex flex-col divide-y divide-border border-t border-border">
            {result.moversAtNeeds.map((m) => (
              <Link
                key={m.id}
                href={`/players/${m.id}`}
                prefetch={false}
                className="flex items-center justify-between gap-3 py-2.5 transition-colors duration-150 hover:bg-surface-raised/70 active:bg-surface-raised/70"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", POSITION_DOT[m.position])} />
                  <span className="truncate text-sm text-ink">{m.name}</span>
                  <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] text-ink-tertiary">
                    {m.position}
                    {m.school && (
                      <>
                        · <SchoolLogo url={m.schoolLogoUrl} size={10} /> {m.school}
                      </>
                    )}
                  </span>
                </div>
                <span className={cn("shrink-0 font-mono text-sm font-semibold", m.delta > 0 ? "text-riser" : "text-faller")}>
                  {m.delta > 0 ? "+" : ""}
                  {m.delta.toFixed(1)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {topNeeds.length === 0 ? (
        <p className="mt-8 text-sm text-ink-secondary">
          Every skill position on your roster ranks solidly (66th percentile or better) against this league — no
          strong positional lean to recommend around right now.
        </p>
      ) : (
        <div className="mt-8 space-y-8">
          <p className="text-sm text-ink-secondary">
            Recommended future-draft targets, ranked by need — starting with your biggest gap (
            <span className="font-semibold text-ink">{topNeeds[0]?.position}</span>).
          </p>
          {result.recommendations.map((group) => (
            <div key={group.position}>
              <div className="flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full", POSITION_DOT[group.position])} />
                <h3 className="font-display text-base font-semibold text-ink">{group.position}</h3>
                <span className="font-mono text-[10px] text-ink-tertiary">
                  {ordinalSuffix(group.need.percentile)} percentile in your league
                </span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {group.prospects.map((p) => {
                  const score = getScoreForFormat(p, result.format, "STANDARD");
                  const tier = getTierForFormat(p, result.format, "STANDARD");
                  return (
                    <Link
                      key={p.id}
                      href={`/players/${p.id}`}
                      prefetch={false}
                      className="flex items-center justify-between gap-3 border border-border bg-surface px-3 py-2.5 transition-colors duration-150 hover:border-accent/50 active:border-accent/50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{p.name}</p>
                        <p className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-ink-tertiary">
                          <SchoolLogo url={p.schoolLogoUrl} size={10} /> {p.school ?? "—"}
                          {tier && (
                            <>
                              {" · "}
                              <span style={{ color: getTierColor(tier) }}>{tier}</span>
                            </>
                          )}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-sm font-semibold text-ink-secondary">
                        {score !== undefined ? score.toFixed(1) : "—"}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

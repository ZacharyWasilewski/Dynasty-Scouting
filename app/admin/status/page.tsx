import { notFound } from "next/navigation";
import { getCurrentUser, isAdminUser } from "@/lib/auth";
import { getAllStatus, getHealthEvents, getMemorySnapshot, type SourceStatus } from "@/lib/systemStatus";
import { getUsageSummary } from "@/lib/usageTracking";
import { Container } from "@/components/layout/Container";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<SourceStatus, string> = {
  ok: "OK",
  stale: "Stale (serving cache)",
  error: "Error",
  unknown: "Unknown",
};

const STATUS_CLASS: Record<SourceStatus, string> = {
  ok: "text-riser border-riser/30 bg-riser/10",
  // Deepened from the raw #FACC15 (bright yellow) used elsewhere for
  // the fixed "perfect score" gold accent — that value works fine as
  // a badge ring or a background tint, but has the same real
  // contrast problem as text on a light background that the
  // Upside Shot tier and C+ grade colors had, fixed the same way.
  stale: "text-[#B7860B] border-[#B7860B]/30 bg-[#B7860B]/10",
  error: "text-faller border-faller/30 bg-faller/10",
  unknown: "text-ink-tertiary border-border-strong bg-surface-raised",
};

const SOURCE_LABEL: Record<string, string> = {
  "google-sheet": "Google Sheet (core prospect data)",
  "sleeper-players": "Sleeper player directory (headshots + Team Sync)",
  "espn-college-photos": "ESPN college photos (devy headshots)",
  "fantasycalc-1qb": "FantasyCalc values — 1QB",
  "fantasycalc-2qb": "FantasyCalc values — Superflex",
  "data-health": "Data health check",
  email: "Email (Resend)",
};

export default async function AdminStatusPage() {
  const user = await getCurrentUser();
  // Deliberately 404s rather than showing a "not authorized" page —
  // no reason to confirm this route exists to anyone who isn't
  // supposed to be looking at it. Requires an ADMIN_EMAIL env var on
  // Railway (same pattern as RESEND_API_KEY); with nothing set, this
  // page is unreachable by design rather than defaulting open.
  if (!isAdminUser(user)) {
    notFound();
  }

  const status = getAllStatus();
  const events = getHealthEvents();
  const mem = getMemorySnapshot();
  // Excludes the admin's own account — see getUsageSummary's own
  // comment for why: this is the one page where "my own testing
  // traffic" would actively distort every number if left in.
  const usage = await getUsageSummary(7, user.id);
  const sources = Object.keys(SOURCE_LABEL);
  const knownSources = new Set(sources);
  const extraSources = Object.keys(status).filter((s) => !knownSources.has(s));

  return (
    <main className="py-10">
      <Container className="max-w-3xl">
        <p className="font-mono text-[10px] uppercase tracking-widest2 text-accent">Admin</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">System Status</h1>
        <p className="mt-2 text-sm text-ink-secondary">
          Live state of every external data source and the last data-health check — reflects whatever&apos;s currently
          cached in this running process, not a historical log.
        </p>

        <div className="mt-8 border border-border bg-surface p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary">Memory (this process)</p>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div className="border border-border-strong bg-surface-raised p-3">
              <p className="font-mono text-[9px] uppercase tracking-widest2 text-ink-tertiary">RSS</p>
              <p className="mt-1 text-lg font-semibold text-ink">{mem.rssMb} MB</p>
            </div>
            <div className="border border-border-strong bg-surface-raised p-3">
              <p className="font-mono text-[9px] uppercase tracking-widest2 text-ink-tertiary">Heap used</p>
              <p className="mt-1 text-lg font-semibold text-ink">{mem.heapUsedMb} MB</p>
            </div>
            <div className="border border-border-strong bg-surface-raised p-3">
              <p className="font-mono text-[9px] uppercase tracking-widest2 text-ink-tertiary">Heap total</p>
              <p className="mt-1 text-lg font-semibold text-ink">{mem.heapTotalMb} MB</p>
            </div>
          </div>
        </div>

        <div className="mt-6 border border-border bg-surface p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary">Usage — last 7 days</p>
          <p className="mt-1 text-xs text-ink-tertiary">
            Deliberately minimal — aggregate page views and feature-event counts, not a detailed activity log.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="border border-border-strong bg-surface-raised p-3">
              <p className="font-mono text-[9px] uppercase tracking-widest2 text-ink-tertiary">Total page views</p>
              <p className="mt-1 text-lg font-semibold text-ink">{usage.totalEvents.toLocaleString()}</p>
            </div>
            <div className="border border-border-strong bg-surface-raised p-3">
              <p className="font-mono text-[9px] uppercase tracking-widest2 text-ink-tertiary">Unique logged-in users</p>
              <p className="mt-1 text-lg font-semibold text-ink">{usage.uniqueActiveUsers.toLocaleString()}</p>
            </div>
          </div>

          {usage.topPaths.length > 0 && (
            <div className="mt-4">
              <p className="font-mono text-[9px] uppercase tracking-widest2 text-ink-tertiary">Top pages</p>
              <div className="mt-2 flex flex-col gap-1.5">
                {usage.topPaths.map((p) => (
                  <div key={p.path} className="flex items-center justify-between gap-3 text-xs">
                    <span className="min-w-0 truncate text-ink-secondary">{p.path}</span>
                    <span className="shrink-0 font-mono text-ink-tertiary">{p.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {usage.eventCounts.length > 0 && (
            <div className="mt-4">
              <p className="font-mono text-[9px] uppercase tracking-widest2 text-ink-tertiary">Feature events</p>
              <div className="mt-2 flex flex-col gap-1.5">
                {usage.eventCounts.map((e) => (
                  <div key={e.eventType} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-ink-secondary">{e.eventType}</span>
                    <span className="shrink-0 font-mono text-ink-tertiary">{e.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {usage.totalEvents === 0 && (
            <p className="mt-4 text-xs text-ink-tertiary">
              No usage recorded yet — tracking just went live, so this fills in as real traffic comes through.
            </p>
          )}
        </div>

        <div className="mt-6 border border-border bg-surface">
          <p className="border-b border-border px-4 py-3 font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary">
            Data sources
          </p>
          {[...sources, ...extraSources].map((source) => {
            const report = status[source];
            const s: SourceStatus = report?.status ?? "unknown";
            return (
              <div key={source} className="flex flex-col gap-2 border-b border-border px-4 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{SOURCE_LABEL[source] ?? source}</p>
                  <p className="mt-0.5 truncate text-xs text-ink-tertiary">{report?.message ?? "No report yet this process."}</p>
                  {report?.lastSuccessAt && (
                    <p className="mt-0.5 font-mono text-[9px] text-ink-tertiary">
                      Last success: {new Date(report.lastSuccessAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <span className={`shrink-0 self-start rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest2 ${STATUS_CLASS[s]}`}>
                  {STATUS_LABEL[s]}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-6 border border-border bg-surface">
          <p className="border-b border-border px-4 py-3 font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary">
            Recent data-health events
          </p>
          {events.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ink-tertiary">
              None reported yet this process — a good sign, not a missing feature.
            </p>
          ) : (
            events.map((e, i) => (
              <div key={i} className="border-b border-border px-4 py-3 text-sm text-ink-secondary last:border-0">
                <p className="font-mono text-[9px] text-ink-tertiary">{new Date(e.at).toLocaleString()}</p>
                <p className="mt-0.5">{e.message}</p>
              </div>
            ))
          )}
        </div>

        <p className="mt-6 text-xs text-ink-tertiary">
          Every status here resets to &quot;unknown&quot; on a fresh deploy until each source&apos;s first cycle completes — that&apos;s
          expected, not a problem on its own.
        </p>
      </Container>
    </main>
  );
}

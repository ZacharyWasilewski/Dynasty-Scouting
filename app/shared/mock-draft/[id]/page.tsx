import { notFound } from "next/navigation";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { SectionIntro } from "@/components/layout/SectionIntro";
import { gradeTextColorClass } from "@/lib/utils";
import { query } from "@/lib/db";
import { getCommunityFormatLabel, formatPick, type MockQBFormat, type MockTEFormat } from "@/lib/mockDraft";

export const dynamic = "force-dynamic";

interface SharedPick {
  overall: number;
  playerId: string;
  playerName: string;
  position: string;
  tier: string | null;
  ddScore: number | null;
  grade: string;
  valueGain: number;
  scoreGap: number;
}

interface DraftSettings {
  teams: number;
  qbFormat: MockQBFormat;
  teFormat: MockTEFormat;
}

function gradeTone(grade: string | null) {
  return gradeTextColorClass(grade);
}

async function getSharedDraft(id: string) {
  const rows = await query<{
    class_year: string;
    settings: DraftSettings;
    picks: SharedPick[];
    overall_grade: string | null;
  }>(`SELECT class_year, settings, picks, overall_grade FROM saved_mock_drafts WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function generateMetadata({ params }: { params: { id: string } }) {
  const draft = await getSharedDraft(params.id);
  return { title: draft ? `${draft.class_year} Mock Draft — Dynasty Database` : "Mock Draft — Dynasty Database" };
}

export default async function SharedMockDraftPage({ params }: { params: { id: string } }) {
  const draft = await getSharedDraft(params.id);
  if (!draft) notFound();

  return (
    <main>
      <SectionIntro
        icon={ClipboardList}
        eyebrow={`${draft.class_year} Mock Draft`}
        title="A completed mock draft"
        description={`${getCommunityFormatLabel(draft.settings.qbFormat, draft.settings.teFormat)} · ${draft.settings.teams}-team, shared read-only.`}
      />
      <section className="py-10">
        <Container className="max-w-2xl">
          {draft.overall_grade && (
            <div className="mb-6 flex items-center gap-3 border border-border bg-surface p-5">
              <span className={`font-headline text-5xl leading-none ${gradeTone(draft.overall_grade)}`}>
                {draft.overall_grade}
              </span>
              <span className="font-mono text-xs uppercase tracking-widest2 text-ink-tertiary">
                Overall Draft Grade
              </span>
            </div>
          )}
          <div className="border border-border bg-surface">
            {draft.picks.map((pick) => (
              <Link
                key={pick.overall}
                href={`/players/${pick.playerId}`}
                prefetch={false}
                className="flex items-center gap-3 border-t border-border px-4 py-3 transition-colors duration-150 first:border-t-0 hover:bg-surface-raised active:bg-surface-raised"
              >
                <span className="w-12 shrink-0 font-mono text-xs text-ink-tertiary">
                  {formatPick(pick.overall, draft.settings.teams)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{pick.playerName}</p>
                  <p className="mt-0.5 truncate text-xs text-ink-tertiary">
                    {pick.position}{pick.tier ? ` · ${pick.tier}` : ""}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-sm text-ink-secondary">
                  {pick.ddScore?.toFixed(1) ?? "—"}
                </span>
                <span className={`w-7 shrink-0 text-right font-mono text-sm font-bold ${gradeTone(pick.grade)}`}>
                  {pick.grade}
                </span>
              </Link>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-ink-tertiary">
            Want to run your own?{" "}
            <Link href="/mock-draft" className="text-accent hover:underline">
              Start a Mock Draft
            </Link>
          </p>
        </Container>
      </section>
    </main>
  );
}

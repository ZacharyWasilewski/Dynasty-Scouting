"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, LogIn, Trash2 } from "@/components/ui/SiteIcons";
import { Container } from "@/components/layout/Container";
import { SectionIntro } from "@/components/layout/SectionIntro";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/components/auth/AuthProvider";
import { getCommunityFormatLabel, type MockQBFormat, type MockTEFormat } from "@/lib/mockDraft";
import { gradeTextColorClass } from "@/lib/utils";

function gradeTone(grade: string | null) {
  return gradeTextColorClass(grade);
}

interface SavedDraftSummary {
  id: string;
  classYear: string;
  settings: { teams: number; qbFormat: MockQBFormat; teFormat: MockTEFormat };
  overallGrade: string | null;
  createdAt: string;
}

export function SavedMockDraftsContent() {
  const { user, loading: authLoading } = useAuth();
  const [drafts, setDrafts] = useState<SavedDraftSummary[] | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch("/api/mock-drafts")
      .then((res) => res.json())
      .then((data) => setDrafts(data.drafts ?? []))
      .catch(() => setDrafts([]));
  }, [user]);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await fetch(`/api/mock-drafts/${id}`, { method: "DELETE" });
      setDrafts((prev) => prev?.filter((d) => d.id !== id) ?? null);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main>
      <SectionIntro
        icon={ClipboardList}
        eyebrow="Your History"
        title="Mock Drafts"
        description="Every mock draft you've completed while logged in, saved automatically."
       variant="utility" />
      <section className="py-10">
        <Container className="max-w-2xl">
          {authLoading ? (
            <div className="h-24" />
          ) : !user ? (
            <EmptyState
              icon={LogIn}
              title="Log in to see your saved mock drafts."
              description="Every draft you complete while logged in is saved to your account automatically, so you can look back on it any time."
              action={{ label: "Log in", href: `/login?redirect=${encodeURIComponent("/mock-drafts")}` }}
            />
          ) : drafts === null ? (
            <div className="h-24" />
          ) : drafts.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Your mock drafts will show up here."
              description="Run one against real AI opponents, every completed draft saves automatically while you're logged in, so you can look back at how it played out."
              action={{ label: "Start your first mock draft", href: "/mock-draft" }}
            />
          ) : (
            <div className="border border-border bg-surface">
              {drafts.map((draft) => (
                <div
                  key={draft.id}
                  className="flex items-center gap-3 border-b border-border px-4 py-3.5 last:border-0"
                >
                  <Link href={`/mock-drafts/${draft.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <span className={`w-10 shrink-0 font-data text-2xl font-bold ${gradeTone(draft.overallGrade)}`}>
                      {draft.overallGrade ?? "—"}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink group-hover:text-accent">
                        {draft.classYear} Mock Draft
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[10px] text-ink-tertiary">
                        {draft.settings.teams}-team · {getCommunityFormatLabel(draft.settings.qbFormat, draft.settings.teFormat)} ·{" "}
                        {new Date(draft.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                  </Link>
                  <button
                    onClick={() => handleDelete(draft.id)}
                    disabled={deletingId === draft.id}
                    aria-label="Delete this saved draft"
                    className="flex shrink-0 items-center justify-center p-2 -m-2 text-ink-tertiary transition-colors duration-150 hover:text-faller disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Container>
      </section>
    </main>
  );
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const rl = checkRateLimit(request, { limit: 60, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const rows = await query<{
    id: string;
    class_year: string;
    settings: unknown;
    picks: unknown;
    overall_grade: string | null;
    created_at: string;
  }>(
    `SELECT id, class_year, settings, picks, overall_grade, created_at
     FROM saved_mock_drafts WHERE id = $1 AND user_id = $2`,
    [params.id, user.id]
  );
  const draft = rows[0];
  if (!draft) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return NextResponse.json({
    draft: {
      id: draft.id,
      classYear: draft.class_year,
      settings: draft.settings,
      picks: draft.picks,
      overallGrade: draft.overall_grade,
      createdAt: draft.created_at,
    },
  });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const rl = checkRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  await query(`DELETE FROM saved_mock_drafts WHERE id = $1 AND user_id = $2`, [params.id, user.id]);
  return NextResponse.json({ ok: true });
}

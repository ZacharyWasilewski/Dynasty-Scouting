import crypto from "crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ drafts: [] });

  const rows = await query<{
    id: string;
    class_year: string;
    settings: unknown;
    overall_grade: string | null;
    created_at: string;
  }>(
    `SELECT id, class_year, settings - 'fullBoard' AS settings, overall_grade, created_at
     FROM saved_mock_drafts WHERE user_id = $1 ORDER BY created_at DESC`,
    [user.id]
  );
  return NextResponse.json({
    drafts: rows.map((r) => ({
      id: r.id,
      classYear: r.class_year,
      settings: r.settings,
      overallGrade: r.overall_grade,
      createdAt: r.created_at,
    })),
  });
}

export async function POST(request: Request) {
  const rl = checkRateLimit(request, { limit: 20, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Log in to save mock drafts." }, { status: 401 });
  }

  let body: {
    id?: unknown;
    classYear?: unknown;
    settings?: unknown;
    picks?: unknown;
    overallGrade?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const classYear = typeof body.classYear === "string" ? body.classYear : "";
  if (!classYear || !body.settings || !Array.isArray(body.picks)) {
    return NextResponse.json({ error: "Missing draft data." }, { status: 400 });
  }
  // A completed draft is at most a handful of picks (one per round,
  // 4 rounds max) — anything wildly larger than that isn't a real
  // draft result, so reject rather than store it.
  if (body.picks.length > 20) {
    return NextResponse.json({ error: "Invalid draft data." }, { status: 400 });
  }

  if (JSON.stringify(body.settings).length > 100000) return NextResponse.json({ error: "Invalid settings." }, { status: 400 });
  const id = typeof body.id === "string" && /^[0-9a-f-]{36}$/i.test(body.id) ? body.id : crypto.randomUUID();
  await query(
    `INSERT INTO saved_mock_drafts (id, user_id, class_year, settings, picks, overall_grade)
     VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
    [
      id,
      user.id,
      classYear,
      JSON.stringify(body.settings),
      JSON.stringify(body.picks),
      typeof body.overallGrade === "string" ? body.overallGrade : null,
    ]
  );

  const owned = await query<{ id: string }>(`SELECT id FROM saved_mock_drafts WHERE id=$1 AND user_id=$2`, [id, user.id]);
  if (!owned.length) return NextResponse.json({ error: "Draft could not be saved." }, { status: 409 });
  return NextResponse.json({ id });
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { year: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ prospectIds: null });

  const rows = await query<{ prospect_ids: string[] }>(
    `SELECT prospect_ids FROM custom_boards WHERE user_id = $1 AND class_year = $2`,
    [user.id, params.year]
  );
  return NextResponse.json({ prospectIds: rows[0]?.prospect_ids ?? null });
}

export async function PUT(request: Request, { params }: { params: { year: string } }) {
  const rl = checkRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Log in to save your board." }, { status: 401 });

  let body: { prospectIds?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (
    !Array.isArray(body.prospectIds) ||
    body.prospectIds.length > 1000 ||
    !body.prospectIds.every((id) => typeof id === "string")
  ) {
    return NextResponse.json({ error: "Invalid board data." }, { status: 400 });
  }

  await query(
    `INSERT INTO custom_boards (user_id, class_year, prospect_ids, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (user_id, class_year)
     DO UPDATE SET prospect_ids = $3, updated_at = now()`,
    [user.id, params.year, JSON.stringify(body.prospectIds)]
  );

  return NextResponse.json({ ok: true });
}

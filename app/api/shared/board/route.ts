import crypto from "crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rl = checkRateLimit(request, { limit: 10, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Log in to share your board." }, { status: 401 });

  let body: { classYear?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const classYear = typeof body.classYear === "string" ? body.classYear : "";
  if (!classYear) return NextResponse.json({ error: "Missing class year." }, { status: 400 });

  const rows = await query<{ prospect_ids: string[] }>(
    `SELECT prospect_ids FROM custom_boards WHERE user_id = $1 AND class_year = $2`,
    [user.id, classYear]
  );
  const prospectIds = rows[0]?.prospect_ids;
  if (!prospectIds || prospectIds.length === 0) {
    return NextResponse.json({ error: "Build your board first, then share it." }, { status: 400 });
  }

  const id = crypto.randomUUID();
  await query(
    `INSERT INTO shared_boards (id, user_id, class_year, prospect_ids) VALUES ($1, $2, $3, $4)`,
    [id, user.id, classYear, JSON.stringify(prospectIds)]
  );

  return NextResponse.json({ id });
}

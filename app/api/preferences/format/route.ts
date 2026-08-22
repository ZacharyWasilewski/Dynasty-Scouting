import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";

const VALID_FORMATS = ["1QB", "1QB_TEP", "SUPERFLEX", "SUPERFLEX_TEP"];

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ format: null });

  const rows = await query<{ league_format: string | null }>(
    `SELECT league_format FROM user_preferences WHERE user_id = $1`,
    [user.id]
  );
  return NextResponse.json({ format: rows[0]?.league_format ?? null });
}

export async function POST(request: Request) {
  const rl = checkRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const user = await getCurrentUser();
  // Silent no-op for logged-out users rather than an error — every
  // format-picking page fires this on every change regardless of
  // login state (localStorage is the source of truth for guests),
  // so a 401 here is expected and not worth surfacing.
  if (!user) return NextResponse.json({ ok: false });

  let body: { format?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const format = typeof body.format === "string" ? body.format : "";
  if (!VALID_FORMATS.includes(format)) {
    return NextResponse.json({ error: "Invalid format." }, { status: 400 });
  }

  await query(
    `INSERT INTO user_preferences (user_id, league_format, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (user_id) DO UPDATE SET league_format = EXCLUDED.league_format, updated_at = now()`,
    [user.id, format]
  );
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const rl = checkRateLimit(request, { limit: 60, windowMs: 60_000 });
  if (!rl.allowed) return NextResponse.json({ enabled: false }, { status: 429 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ enabled: false });

  const rows = await query<{ watchlist_notifications_enabled: boolean }>(
    `SELECT watchlist_notifications_enabled FROM notification_preferences WHERE user_id = $1`,
    [user.id]
  );
  return NextResponse.json({ enabled: rows[0]?.watchlist_notifications_enabled ?? false });
}

export async function POST(request: Request) {
  const rl = checkRateLimit(request, { limit: 20, windowMs: 60_000 });
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Log in to change notification settings." }, { status: 401 });

  let body: { enabled?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const enabled = body.enabled === true;

  await query(
    `INSERT INTO notification_preferences (user_id, watchlist_notifications_enabled, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (user_id) DO UPDATE SET watchlist_notifications_enabled = EXCLUDED.watchlist_notifications_enabled, updated_at = now()`,
    [user.id, enabled]
  );

  return NextResponse.json({ ok: true, enabled });
}

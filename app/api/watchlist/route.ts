import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  // Not logged in just means an empty list, not an error — keeps the
  // client simple (no special-casing a 401 just to render "nothing
  // saved"), and WatchlistButton independently checks login state
  // before ever calling the toggle endpoint below.
  if (!user) return NextResponse.json({ ids: [] });

  const rows = await query<{ prospect_id: string }>(
    `SELECT prospect_id FROM watchlist_items WHERE user_id = $1`,
    [user.id]
  );
  return NextResponse.json({ ids: rows.map((r) => r.prospect_id) });
}

export async function POST(request: Request) {
  const rl = checkRateLimit(request, { limit: 60, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Log in to save players." }, { status: 401 });
  }

  let body: { prospectId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const prospectId = typeof body.prospectId === "string" ? body.prospectId : "";
  if (!prospectId) {
    return NextResponse.json({ error: "Missing prospectId." }, { status: 400 });
  }

  // One round trip instead of two: try the delete first, and only
  // insert if nothing was there to delete. A CTE lets both branches
  // run as a single atomic statement rather than a separate
  // SELECT-then-DELETE-or-INSERT sequence.
  const rows = await query<{ deleted_count: string; inserted_count: string }>(
    `WITH deleted AS (
       DELETE FROM watchlist_items WHERE user_id = $1 AND prospect_id = $2 RETURNING 1
     ), inserted AS (
       INSERT INTO watchlist_items (user_id, prospect_id)
       SELECT $1, $2
       WHERE NOT EXISTS (SELECT 1 FROM deleted)
       ON CONFLICT (user_id, prospect_id) DO NOTHING
       RETURNING 1
     )
     SELECT
       (SELECT count(*) FROM deleted) AS deleted_count,
       (SELECT count(*) FROM inserted) AS inserted_count`,
    [user.id, prospectId]
  );
  const saved = Number(rows[0]?.inserted_count ?? 0) > 0;

  return NextResponse.json({ prospectId, saved });
}

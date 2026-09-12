import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const rl = checkRateLimit(request, { limit: 60, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ classYears: [], error: "Too many requests." }, { status: 429 });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ classYears: [] });

  const rows = await query<{ class_year: string }>(
    `SELECT class_year FROM custom_boards WHERE user_id = $1 ORDER BY class_year DESC`,
    [user.id]
  );
  return NextResponse.json({ classYears: rows.map((r) => r.class_year) });
}

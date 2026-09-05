import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { recordLastSeenAndGetPrevious } from "@/lib/usageTracking";
import { checkRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // Does a read plus an upsert per call, and fires on navigation —
  // generous ceiling, but bounded so a loop can't drive DB writes.
  const rl = checkRateLimit(request, { limit: 60, windowMs: 60_000 });
  if (!rl.allowed) {
    // Matches this route's existing "never surface an error" style —
    // a missed since-last-visit comparison is invisible to the user.
    return NextResponse.json({ previousVisit: null });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ previousVisit: null });

  let body: { page?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ previousVisit: null });
  }
  const page = typeof body.page === "string" ? body.page.slice(0, 64) : null;
  if (!page) return NextResponse.json({ previousVisit: null });

  const previous = await recordLastSeenAndGetPrevious(user.id, page);
  return NextResponse.json({ previousVisit: previous ? previous.toISOString() : null });
}

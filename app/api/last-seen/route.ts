import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { recordLastSeenAndGetPrevious } from "@/lib/usageTracking";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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

import { NextResponse } from "next/server";
import { getCurrentUser, isAdminUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Hits the database on every call and is reachable without being
  // logged in, which makes it the cheapest endpoint here to hammer.
  // Generous limit — the client legitimately calls this on load and
  // after any auth change, so this only ever catches a scripted loop.
  const rl = checkRateLimit(request, { limit: 60, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ user: null, error: "Too many requests." }, { status: 429 });
  }

  const user = await getCurrentUser();
  return NextResponse.json({ user: user ? { ...user, isAdmin: isAdminUser(user) } : null });
}

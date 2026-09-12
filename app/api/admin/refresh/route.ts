import { NextResponse } from "next/server";
import { getCurrentUser, isAdminUser } from "@/lib/auth";
import { forceSheetRefresh } from "@/lib/googleSheets";
import { checkRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * Server-side is the only real gate — the button on the admin page is
 * a convenience, not the security boundary. A non-admin who somehow
 * discovers this URL and POSTs to it directly gets the exact same 404
 * an unauthenticated request would, never a 401/403 that would
 * confirm the route exists at all, matching /admin/status's own
 * established convention.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Low limit deliberately — this is an expensive, rarely-needed
  // action (a full live refetch of every data source), not something
  // that should ever be looped or hammered even by the one person
  // authorized to call it.
  const rl = checkRateLimit(request, { limit: 5, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many refresh requests. Wait a moment and try again." }, { status: 429 });
  }

  try {
    const result = await forceSheetRefresh();
    return NextResponse.json({
      ok: true,
      prospectCount: result.prospectCount,
      version: result.version,
      refreshedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[admin-refresh] Forced refresh failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Refresh failed." },
      { status: 500 }
    );
  }
}

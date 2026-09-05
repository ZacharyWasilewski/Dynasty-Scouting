import { NextResponse } from "next/server";
import { getSheetSnapshot } from "@/lib/googleSheets";
import { checkRateLimit } from "@/lib/rateLimit";

// Tiny version endpoint used only to validate client-side navigations and
// long-lived tools against the canonical server snapshot. It never returns a
// second copy of prospect data and carries no independent cache.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  // Cheap and cached, but publicly reachable — a high ceiling keeps
  // legitimate polling working while still bounding a runaway client.
  const rl = checkRateLimit(request, { limit: 120, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { version: null, error: "Too many requests." },
      { status: 429, headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } }
    );
  }

  try {
    const snapshot = await getSheetSnapshot();
    return NextResponse.json(
      {
        version: snapshot.version,
        expiresAt: new Date(snapshot.expires).toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0, must-revalidate",
          "CDN-Cache-Control": "no-store",
          "Vary": "RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Url",
        },
      }
    );
  } catch (err) {
    return NextResponse.json(
      { version: null, error: err instanceof Error ? err.message : "Failed to read snapshot version" },
      { status: 502, headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } }
    );
  }
}

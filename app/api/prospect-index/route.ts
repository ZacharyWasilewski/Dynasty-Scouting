import { NextResponse } from "next/server";
import { getSheetSnapshot } from "@/lib/googleSheets";
import { checkRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Minimal search payload. Global search only needs identity/navigation fields,
 * so do not serialize the full score/model object every time Cmd+K opens.
 */
export async function GET(request: Request) {
  const rl = checkRateLimit(request, { limit: 60, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { prospects: [], error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }
  try {
    const snapshot = await getSheetSnapshot();
    const prospects = snapshot.data.prospects.map((p) => ({
      id: p.id,
      name: p.name,
      position: p.position,
      draftClass: p.draftClass,
      school: p.school,
      schoolLogoUrl: p.schoolLogoUrl,
      ddRank1QB: p.ddRank1QB,
      ddRank1QBTEP: p.ddRank1QBTEP,
      ddRankSuperflex: p.ddRankSuperflex,
      ddRankSuperflexTEP: p.ddRankSuperflexTEP,
    }));
    return NextResponse.json(
      { prospects, version: snapshot.version },
      { headers: {
        "Cache-Control": "no-store, max-age=0, must-revalidate",
        "CDN-Cache-Control": "no-store",
        "X-DD-Snapshot-Version": String(snapshot.version),
      } }
    );
  } catch (err) {
    return NextResponse.json(
      { prospects: [], error: err instanceof Error ? err.message : "Failed to load search index" },
      { status: 502, headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } }
    );
  }
}

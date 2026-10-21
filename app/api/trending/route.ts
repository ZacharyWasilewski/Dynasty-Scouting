import { NextResponse } from "next/server";
import { getSheetSnapshot } from "@/lib/googleSheets";
import { getScoreDeltas } from "@/lib/trending";
import { checkRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const rl = checkRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ deltas: {}, error: "Too many requests" }, { status: 429 });
  }

  try {
    const snapshot = await getSheetSnapshot();
    const deltas = await getScoreDeltas(snapshot.data.prospects);
    return NextResponse.json(
      { deltas: Object.fromEntries(deltas), version: snapshot.version },
      { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate", "X-DD-Snapshot-Version": String(snapshot.version) } }
    );
  } catch (err) {
    return NextResponse.json(
      { deltas: {}, error: err instanceof Error ? err.message : "Failed to load deltas" },
      { status: 502 }
    );
  }
}

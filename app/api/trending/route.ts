import { NextResponse } from "next/server";
import { getProspects } from "@/lib/googleSheets";
import { getScoreDeltas } from "@/lib/trending";
import { checkRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const rl = checkRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ deltas: {}, error: "Too many requests" }, { status: 429 });
  }

  try {
    const prospects = await getProspects();
    const deltas = await getScoreDeltas(prospects);
    return NextResponse.json({ deltas: Object.fromEntries(deltas) });
  } catch (err) {
    return NextResponse.json(
      { deltas: {}, error: err instanceof Error ? err.message : "Failed to load deltas" },
      { status: 502 }
    );
  }
}

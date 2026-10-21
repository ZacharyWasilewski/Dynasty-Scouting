import { NextResponse } from "next/server";
import { getActiveMockClass } from "@/lib/mockDraft";
import { getLiveFantasyCalcRankings } from "@/lib/fantasyCalcData";
import { checkRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Lower limit than /api/prospects — this one proxies out to
  // FantasyCalc's own API, so an unthrottled loop here would also
  // hammer their service through ours, not just this server.
  const rl = checkRateLimit(request, { limit: 20, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { source: "unavailable", classYear: null, rankings: {}, error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  const url = new URL(request.url);
  const classYear = url.searchParams.get("class") || getActiveMockClass();
  try {
    const rankings = await getLiveFantasyCalcRankings(classYear);
    const available = Object.values(rankings).some((snapshot) => Object.keys(snapshot.players).length > 0);
    return NextResponse.json({
      source: available ? "fantasycalc" : "unavailable",
      classYear,
      rankings,
      attribution: { name: "FantasyCalc", url: "https://fantasycalc.com/" },
    });
  } catch {
    return NextResponse.json({
      source: "unavailable",
      classYear,
      rankings: {},
    });
  }
}

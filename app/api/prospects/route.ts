import { NextResponse } from "next/server";
import { getSheetSnapshot } from "@/lib/googleSheets";
import { checkRateLimit } from "@/lib/rateLimit";

// This endpoint feeds client-side search/compare. It must not carry its own
// ISR response cache on top of the canonical versioned sheet snapshot.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  // 30/min is generous for real browsing (this fires once per page
  // load) while still blocking a scripted loop from scraping the
  // full graded dataset — DD Score is the site's actual product.
  const rl = checkRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { prospects: [], error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  try {
    const snapshot = await getSheetSnapshot();
    return NextResponse.json(
      { prospects: snapshot.data.prospects, version: snapshot.version },
      { headers: {
        "Cache-Control": "no-store, max-age=0, must-revalidate",
        "CDN-Cache-Control": "no-store",
        "X-DD-Snapshot-Version": String(snapshot.version),
      } }
    );
  } catch (err) {
    return NextResponse.json(
      { prospects: [], error: err instanceof Error ? err.message : "Failed to load prospects" },
      { status: 502 }
    );
  }
}

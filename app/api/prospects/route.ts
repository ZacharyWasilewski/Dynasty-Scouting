import { NextResponse } from "next/server";
import { getProspects } from "@/lib/googleSheets";
import { checkRateLimit } from "@/lib/rateLimit";

export const revalidate = 60;

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
    const prospects = await getProspects();
    return NextResponse.json({ prospects });
  } catch (err) {
    return NextResponse.json(
      { prospects: [], error: err instanceof Error ? err.message : "Failed to load prospects" },
      { status: 502 }
    );
  }
}

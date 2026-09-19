import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { recordEvent } from "@/lib/usageTracking";
import { checkRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Generous limit — this fires on every single page navigation for
// every visitor, unlike most rate-limited routes here which guard
// meaningfully expensive or abusable actions.
const EVENT_TYPE_MAX_LENGTH = 64;
const PATH_MAX_LENGTH = 200;

export async function POST(request: Request) {
  const rl = checkRateLimit(request, { limit: 120, windowMs: 60_000 });
  if (!rl.allowed) {
    // Silently drop rather than surface an error — a dropped
    // analytics event is invisible and harmless; there's nothing
    // useful for a caller to do with a 429 here.
    return NextResponse.json({ ok: false });
  }

  let body: { eventType?: unknown; path?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false });
  }

  const eventType = typeof body.eventType === "string" ? body.eventType.slice(0, EVENT_TYPE_MAX_LENGTH) : null;
  const path = typeof body.path === "string" ? body.path.slice(0, PATH_MAX_LENGTH) : null;
  if (!eventType) return NextResponse.json({ ok: false });

  const user = await getCurrentUser();
  // Not awaited on the response path — see recordEvent's own comment
  // for why a tracking failure should never surface to the caller;
  // there's equally no reason to make every page navigation wait on
  // this DB write completing.
  void recordEvent(eventType, path, user?.id ?? null);

  return NextResponse.json({ ok: true });
}

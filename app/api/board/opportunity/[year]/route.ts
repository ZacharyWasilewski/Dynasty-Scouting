import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";
import { getOpportunityScales, getSheetData } from "@/lib/googleSheets";
import { scoreWithOpportunityOverride } from "@/lib/opportunityOverrides";
import {
  OPPORTUNITY_OPTIONS_BY_POSITION,
  normalizeOpportunityLabel,
  type OpportunityPosition,
} from "@/lib/opportunityScales";

export const dynamic = "force-dynamic";

function positionOf(position: string): OpportunityPosition | undefined {
  return position === "QB" || position === "RB" || position === "WR" || position === "TE"
    ? position
    : undefined;
}

export async function GET(request: Request, { params }: { params: { year: string } }) {
  const rl = checkRateLimit(request, { limit: 60, windowMs: 60_000 });
  if (!rl.allowed) return NextResponse.json({ overrides: {}, scales: {} }, { status: 429 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ overrides: {}, scales: {} });

  const [rows, scales] = await Promise.all([
    query<{ prospect_id: string; opportunity: string }>(
      `SELECT prospect_id, opportunity FROM board_opportunity_overrides WHERE user_id = $1 AND class_year = $2`,
      [user.id, params.year]
    ),
    getOpportunityScales(),
  ]);

  return NextResponse.json({
    overrides: Object.fromEntries(rows.map((r) => [r.prospect_id, r.opportunity])),
    // Only the multipliers go to the client — it needs them to decide
    // which options to show. The weights used for recalculation stay
    // server-side so a submitted score can't be influenced by them.
    scales: Object.fromEntries(
      Object.entries(scales).map(([position, scale]) => [position, scale.multipliers])
    ),
  });
}

export async function PUT(request: Request, { params }: { params: { year: string } }) {
  const rl = checkRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Log in to adjust opportunity." }, { status: 401 });

  let body: { prospectId?: unknown; opportunity?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (typeof body.prospectId !== "string" || typeof body.opportunity !== "string") {
    return NextResponse.json({ error: "Invalid override." }, { status: 400 });
  }

  const [sheetData, scales] = await Promise.all([getSheetData(), getOpportunityScales()]);
  const prospects = sheetData.prospects;
  const prospect = prospects.find(
    (p) => p.id === body.prospectId && String(p.draftClass) === params.year
  );
  if (!prospect) return NextResponse.json({ error: "Invalid prospect." }, { status: 400 });

  const position = positionOf(prospect.position);
  if (!position) {
    return NextResponse.json({ error: "Opportunity isn't modelled for this position." }, { status: 400 });
  }

  // Re-validate the submitted label server-side rather than trusting
  // whatever the client sent — the UI restricts the options, but that's
  // a convenience, not a guarantee.
  const wanted = normalizeOpportunityLabel(String(body.opportunity));
  const opportunity = OPPORTUNITY_OPTIONS_BY_POSITION[position].find(
    (option) => normalizeOpportunityLabel(option) === wanted
  );
  if (!opportunity) {
    return NextResponse.json({ error: "Invalid opportunity value for this position." }, { status: 400 });
  }

  const scale = scales[position];
  const result = scoreWithOpportunityOverride(
    prospects,
    prospect.id,
    opportunity,
    Object.fromEntries(Object.entries(scales).map(([key, value]) => [key, value.multipliers])),
    scale.opportunityWeight
  );
  if (result === undefined) {
    return NextResponse.json(
      { error: "This player cannot be recalculated from an opportunity override." },
      { status: 400 }
    );
  }

  await query(
    `INSERT INTO board_opportunity_overrides (user_id, class_year, prospect_id, opportunity, updated_at)
     VALUES ($1,$2,$3,$4,now())
     ON CONFLICT (user_id,class_year,prospect_id)
     DO UPDATE SET opportunity = EXCLUDED.opportunity, updated_at = now()`,
    [user.id, params.year, prospect.id, opportunity]
  );

  return NextResponse.json({ ok: true, score: result.ddScore, positionalScore: result.positionalScore });
}

export async function DELETE(request: Request, { params }: { params: { year: string } }) {
  const rl = checkRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Log in to adjust opportunity." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const prospectId = searchParams.get("prospectId");

  // "Reset to DD order" clears the whole class at once. Requires an
  // explicit all=1 rather than treating a missing prospectId as
  // "delete everything", so a malformed single-player request can
  // never silently wipe someone's entire board.
  if (searchParams.get("all") === "1") {
    await query(
      `DELETE FROM board_opportunity_overrides WHERE user_id=$1 AND class_year=$2`,
      [user.id, params.year]
    );
    return NextResponse.json({ ok: true });
  }

  if (!prospectId) return NextResponse.json({ error: "Missing prospect." }, { status: 400 });

  await query(
    `DELETE FROM board_opportunity_overrides WHERE user_id=$1 AND class_year=$2 AND prospect_id=$3`,
    [user.id, params.year, prospectId]
  );
  return NextResponse.json({ ok: true });
}

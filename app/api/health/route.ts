import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAllStatus } from "@/lib/systemStatus";

export const dynamic = "force-dynamic";

/**
 * Deliberately requires no auth. The admin status page is the rich
 * version of this, but it requires logging in — which requires
 * Postgres — so it's useless for the one failure mode that matters
 * most: Postgres itself being unreachable. An admin locked out that
 * way had no way to confirm it from inside the app at all, only from
 * Railway's own dashboard.
 *
 * Intended for Railway's own health checks or an external uptime
 * monitor, not for people — it returns plain JSON, not a page.
 */
export async function GET() {
  const checks: Record<string, "ok" | "error"> = {};

  try {
    await query("SELECT 1");
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }

  // The sheet snapshot's own status, as already tracked for the admin
  // page — reused rather than re-fetched, since a health check should
  // never itself trigger an expensive operation.
  const sheetStatus = getAllStatus()["google-sheet"];
  checks.sheetData = sheetStatus?.status === "error" ? "error" : "ok";

  const healthy = Object.values(checks).every((v) => v === "ok");

  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", checks, checkedAt: new Date().toISOString() },
    { status: healthy ? 200 : 503 }
  );
}

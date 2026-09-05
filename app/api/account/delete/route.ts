import { NextResponse } from "next/server";
import { getCurrentUser, verifyUserCredentials, deleteUserAccount, SESSION_COOKIE } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * Requires the user's current password, re-verified server-side via
 * the same verifyUserCredentials already used at login — this is a
 * real reauthentication step, not just a "type DELETE to confirm"
 * text box, since account deletion is irreversible and a session
 * alone (which could be a stolen/left-open browser tab) isn't enough
 * proof of intent for a destructive action this permanent.
 */
export async function POST(request: Request) {
  const rl = checkRateLimit(request, { limit: 5, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many attempts. Wait a moment and try again." }, { status: 429 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Log in to delete your account." }, { status: 401 });
  }

  let body: { password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const password = typeof body.password === "string" ? body.password : "";
  if (!password) {
    return NextResponse.json({ error: "Enter your password to confirm." }, { status: 400 });
  }

  const verified = await verifyUserCredentials(user.email, password);
  if (!verified) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  try {
    await deleteUserAccount(user.id);
  } catch (err) {
    console.error("[account-delete] Failed to delete account:", err);
    return NextResponse.json({ error: "Something went wrong. Your account was not deleted." }, { status: 500 });
  }

  // The session row is already gone (cascade-deleted along with the
  // user row above), but the browser's cookie still exists until
  // explicitly cleared — same reasoning as the plain logout route.
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", expires: new Date(0) });
  return res;
}

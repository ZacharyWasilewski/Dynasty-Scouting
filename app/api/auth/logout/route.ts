import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteSession, SESSION_COOKIE } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(request: Request) {
  const rl = checkRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429 });
  }

  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      await deleteSession(token);
    } catch {
      // Even if the DB delete fails, still clear the cookie below —
      // an orphaned expired-eventually session row isn't a real
      // problem, but a cookie that silently fails to clear is a
      // confusing "log out did nothing" experience.
    }
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", expires: new Date(0) });
  return res;
}

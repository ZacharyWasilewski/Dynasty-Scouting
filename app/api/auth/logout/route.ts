import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteSession, SESSION_COOKIE } from "@/lib/auth";

export async function POST() {
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

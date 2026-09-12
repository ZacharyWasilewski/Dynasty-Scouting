import { NextResponse } from "next/server";
import { resetPasswordWithToken } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";

const MIN_PASSWORD_LENGTH = 8;

export async function POST(request: Request) {
  const rl = checkRateLimit(request, { limit: 10, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });
  }

  let body: { token?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!token) {
    return NextResponse.json({ error: "Missing or invalid reset link." }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` }, { status: 400 });
  }

  try {
    const user = await resetPasswordWithToken(token, password);
    if (!user) {
      return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[reset-password] failed:", err);
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}

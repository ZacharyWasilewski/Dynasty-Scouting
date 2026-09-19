import { NextResponse } from "next/server";
import { getUserByEmail, createPasswordResetToken, isValidEmail } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(request: Request) {
  const rl = checkRateLimit(request, { limit: 5, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });
  }

  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email : "";
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  // Always respond with the same generic success message whether or
  // not the email is registered — telling the two apart would let
  // someone enumerate which addresses have accounts. The actual
  // email only goes out if a matching user exists.
  const genericResponse = NextResponse.json({
    message: "If an account exists for that email, a reset link is on its way.",
  });

  try {
    const user = await getUserByEmail(email);
    if (!user) return genericResponse;

    const { token } = await createPasswordResetToken(user.id);
    const origin = request.headers.get("origin") ?? new URL(request.url).origin;
    const resetUrl = `${origin}/reset-password?token=${token}`;
    await sendPasswordResetEmail(user.email, resetUrl);
  } catch (err) {
    // Still return the generic success message — surfacing a
    // send failure here would itself confirm the email exists.
    console.error("[forgot-password] failed:", err);
  }

  return genericResponse;
}

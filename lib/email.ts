import { reportStatus } from "@/lib/systemStatus";

// Deliberately not using Resend's npm SDK — their REST API is a
// single plain fetch call, and avoiding a new dependency here means
// this doesn't need `npm install` to run cleanly before it can be
// reviewed. Requires a RESEND_API_KEY env var on Railway; see the
// README note added alongside this file for setup.
const RESEND_API_URL = "https://api.resend.com/emails";

// Resend requires the "from" address to be on a domain you've
// verified with them — until dynastydatabase.com is verified there,
// use Resend's own shared sandbox sender so this works out of the
// box. Swap this once the real domain is verified (better
// deliverability, no "via resend.dev" in the sender line).
const FROM_ADDRESS = "Dynasty Database <onboarding@resend.dev>";

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[email] RESEND_API_KEY is not set — cannot send password reset email.");
    reportStatus("email", "error", "RESEND_API_KEY is not set — password reset emails cannot send");
    return { ok: false, error: "Email isn't configured yet." };
  }

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to,
        subject: "Reset your Dynasty Database password",
        html: `
          <p>Someone (hopefully you) asked to reset the password on your Dynasty Database account.</p>
          <p><a href="${resetUrl}">Click here to set a new password</a>. This link works for 30 minutes.</p>
          <p>If you didn't request this, you can ignore this email — your password won't change.</p>
        `,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[email] Resend returned ${res.status}: ${body}`);
      // Deliberately no email address in this status report — this
      // is visible on an admin page, but "which email just failed to
      // send" is exactly the kind of thing that shouldn't leak even
      // there if it can be avoided.
      reportStatus("email", "error", `Resend returned ${res.status} on last send attempt`);
      return { ok: false, error: "Couldn't send the reset email." };
    }
    reportStatus("email", "ok", "Last send succeeded");
    return { ok: true };
  } catch (err) {
    console.error("[email] Resend request failed:", err);
    reportStatus("email", "error", `Resend request failed: ${err instanceof Error ? err.message : String(err)}`);
    return { ok: false, error: "Couldn't send the reset email." };
  }
}

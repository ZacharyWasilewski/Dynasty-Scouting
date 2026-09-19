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

/**
 * The one real Resend call in the whole app — every email type
 * (password reset, watchlist notifications, anything added later)
 * goes through this rather than each having its own copy of the
 * fetch/error-handling/status-reporting boilerplate. Extending to a
 * new notification type should only ever mean writing its subject
 * and HTML, never touching this function.
 */
async function sendEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[email] RESEND_API_KEY is not set — cannot send email.");
    reportStatus("email", "error", "RESEND_API_KEY is not set — emails cannot send");
    return { ok: false, error: "Email isn't configured yet." };
  }

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[email] Resend returned ${res.status}: ${body}`);
      // Deliberately no email address in this status report — this
      // is visible on an admin page, but "which email just failed to
      // send" is exactly the kind of thing that shouldn't leak even
      // there if it can be avoided.
      reportStatus("email", "error", `Resend returned ${res.status} on last send attempt`);
      return { ok: false, error: "Couldn't send the email." };
    }
    reportStatus("email", "ok", "Last send succeeded");
    return { ok: true };
  } catch (err) {
    console.error("[email] Resend request failed:", err);
    reportStatus("email", "error", `Resend request failed: ${err instanceof Error ? err.message : String(err)}`);
    return { ok: false, error: "Couldn't send the email." };
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<{ ok: boolean; error?: string }> {
  return sendEmail(
    to,
    "Reset your Dynasty Database password",
    `
      <p>Someone (hopefully you) asked to reset the password on your Dynasty Database account.</p>
      <p><a href="${resetUrl}">Click here to set a new password</a>. This link works for 30 minutes.</p>
      <p>If you didn't request this, you can ignore this email — your password won't change.</p>
    `
  );
}

interface WatchlistNotificationItem {
  prospectName: string;
  prospectId: string;
  eventType: "tier_change" | "score_change";
  oldValue: string;
  newValue: string;
  format: string;
}

/**
 * One email per user per notification run, listing every qualifying
 * change across their watchlist — not one email per player, which
 * would spam anyone with more than a couple of watched players
 * moving in the same cycle.
 */
export async function sendWatchlistNotificationEmail(
  to: string,
  items: WatchlistNotificationItem[]
): Promise<{ ok: boolean; error?: string }> {
  const baseUrl = process.env.SITE_URL ?? "https://dynastydatabase.com";
  const rows = items
    .map((item) => {
      const label = item.eventType === "tier_change" ? "Tier change" : "Score change";
      return `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #E3E5E9;">
            <a href="${baseUrl}/players/${item.prospectId}" style="color:#2563EB;text-decoration:none;font-weight:600;font-size:14px;">${item.prospectName}</a>
            <div style="margin-top:4px;font-size:12px;color:#6B7280;">
              ${label} · ${item.format} · ${item.oldValue} → <strong style="color:#111827;">${item.newValue}</strong>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;">
      <p style="font-size:13px;text-transform:uppercase;letter-spacing:0.05em;color:#6B7280;margin-bottom:4px;">Dynasty Database</p>
      <h1 style="font-size:20px;margin:0 0 16px;color:#111827;">Watchlist update</h1>
      <p style="font-size:14px;color:#374151;line-height:1.5;">
        ${items.length} player${items.length === 1 ? "" : "s"} on your watchlist changed:
      </p>
      <table style="width:100%;border-collapse:collapse;margin-top:8px;">${rows}</table>
      <p style="margin-top:24px;font-size:12px;color:#9CA3AF;">
        You're getting this because you opted in to watchlist notifications.
        <a href="${baseUrl}/my-stuff" style="color:#6B7280;">Manage notification settings</a>.
      </p>
    </div>
  `;

  const subject =
    items.length === 1
      ? `${items[0]!.prospectName}: ${items[0]!.eventType === "tier_change" ? "tier change" : "score change"}`
      : `${items.length} watchlist updates`;

  return sendEmail(to, subject, html);
}


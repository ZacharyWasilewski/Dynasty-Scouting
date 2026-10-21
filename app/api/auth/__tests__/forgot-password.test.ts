import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: () => ({ allowed: true, limit: 5, remaining: 4, resetAt: Date.now() + 60_000 }),
}));

const getUserByEmail = vi.fn();
const createPasswordResetToken = vi.fn();
vi.mock("@/lib/auth", () => ({
  getUserByEmail: (...args: unknown[]) => getUserByEmail(...args),
  createPasswordResetToken: (...args: unknown[]) => createPasswordResetToken(...args),
  isValidEmail: (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
}));

const sendPasswordResetEmail = vi.fn();
vi.mock("@/lib/email", () => ({
  sendPasswordResetEmail: (...args: unknown[]) => sendPasswordResetEmail(...args),
}));

const { POST } = await import("@/app/api/auth/forgot-password/route");

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => {
    getUserByEmail.mockReset();
    createPasswordResetToken.mockReset();
    sendPasswordResetEmail.mockReset();
  });

  it("rejects an invalid email format", async () => {
    const res = await POST(jsonRequest({ email: "not-an-email" }));
    expect(res.status).toBe(400);
  });

  it("returns the same generic success message whether or not the email is registered", async () => {
    getUserByEmail.mockResolvedValue(null);
    const notFoundRes = await POST(jsonRequest({ email: "nobody@example.com" }));
    const notFoundBody = await notFoundRes.json();

    getUserByEmail.mockResolvedValue({ id: "u1", email: "real@example.com" });
    createPasswordResetToken.mockResolvedValue({ token: "abc123", expiresAt: new Date() });
    sendPasswordResetEmail.mockResolvedValue({ ok: true });
    const foundRes = await POST(jsonRequest({ email: "real@example.com" }));
    const foundBody = await foundRes.json();

    // The whole point of this endpoint's security model — an
    // attacker sending both a real and a fake email must not be able
    // to tell them apart from the response alone.
    expect(notFoundRes.status).toBe(foundRes.status);
    expect(notFoundBody.message).toBe(foundBody.message);
  });

  it("only actually sends an email when the account exists", async () => {
    getUserByEmail.mockResolvedValue(null);
    await POST(jsonRequest({ email: "nobody@example.com" }));
    expect(createPasswordResetToken).not.toHaveBeenCalled();
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();

    getUserByEmail.mockResolvedValue({ id: "u1", email: "real@example.com" });
    createPasswordResetToken.mockResolvedValue({ token: "abc123", expiresAt: new Date() });
    sendPasswordResetEmail.mockResolvedValue({ ok: true });
    await POST(jsonRequest({ email: "real@example.com" }));
    expect(createPasswordResetToken).toHaveBeenCalledWith("u1");
    expect(sendPasswordResetEmail).toHaveBeenCalled();
  });

  it("still returns the generic success message even if sending the email throws", async () => {
    getUserByEmail.mockResolvedValue({ id: "u1", email: "real@example.com" });
    createPasswordResetToken.mockResolvedValue({ token: "abc123", expiresAt: new Date() });
    sendPasswordResetEmail.mockRejectedValue(new Error("Resend is down"));

    const res = await POST(jsonRequest({ email: "real@example.com" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toMatch(/reset link is on its way/i);
  });
});

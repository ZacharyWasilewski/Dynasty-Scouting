import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: () => ({ allowed: true, limit: 10, remaining: 9, resetAt: Date.now() + 60_000 }),
}));

const resetPasswordWithToken = vi.fn();
vi.mock("@/lib/auth", () => ({
  resetPasswordWithToken: (...args: unknown[]) => resetPasswordWithToken(...args),
}));

// Imported after the mocks above so the route picks up the mocked modules.
const { POST } = await import("@/app/api/auth/reset-password/route");

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/reset-password", () => {
  beforeEach(() => {
    resetPasswordWithToken.mockReset();
  });

  it("rejects a missing token", async () => {
    const res = await POST(jsonRequest({ token: "", password: "longenoughpassword" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/reset link/i);
    expect(resetPasswordWithToken).not.toHaveBeenCalled();
  });

  it("rejects a password shorter than 8 characters", async () => {
    const res = await POST(jsonRequest({ token: "sometoken", password: "short" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/8 characters/);
    expect(resetPasswordWithToken).not.toHaveBeenCalled();
  });

  it("returns an error for an invalid or expired token", async () => {
    resetPasswordWithToken.mockResolvedValue(null);
    const res = await POST(jsonRequest({ token: "badtoken", password: "longenoughpassword" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/invalid or has expired/i);
  });

  it("succeeds with a valid token and password", async () => {
    resetPasswordWithToken.mockResolvedValue({ id: "u1", email: "zach@example.com" });
    const res = await POST(jsonRequest({ token: "goodtoken", password: "longenoughpassword" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(resetPasswordWithToken).toHaveBeenCalledWith("goodtoken", "longenoughpassword");
  });
});

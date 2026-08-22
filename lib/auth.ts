import crypto from "crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { query } from "@/lib/db";

export const SESSION_COOKIE = "dd_session";
const SESSION_DAYS = 30;
const BCRYPT_ROUNDS = 12;

export interface AuthUser {
  id: string;
  email: string;
}

/**
 * Single source of truth for "is this the admin" — used by every
 * route that returns a user to the client (login, signup, /me) so
 * the admin nav link (added in ProfileMenu/MobileMoreSheet) can show
 * consistently everywhere, not just after a full page reload
 * re-triggers /api/auth/me. Also used directly by the admin page
 * itself, so there's exactly one place this comparison logic lives.
 */
export function isAdminUser(user: AuthUser | null): user is AuthUser {
  if (!user) return false;
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return Boolean(adminEmail) && user.email.toLowerCase() === adminEmail;
}

export function isValidEmail(email: string): boolean {
  // Deliberately permissive — this only needs to reject obvious
  // junk, not fully validate RFC 5322. The real check that matters
  // is whether someone can receive mail there, which no regex can do.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Throws if the email is already registered (unique constraint). */
export async function createUser(email: string, password: string): Promise<AuthUser> {
  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await hashPassword(password);
  const id = crypto.randomUUID();
  try {
    await query(
      `INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)`,
      [id, normalizedEmail, passwordHash]
    );
  } catch (err) {
    // Postgres unique_violation
    if (err instanceof Error && "code" in err && (err as { code?: string }).code === "23505") {
      throw new Error("An account with that email already exists.");
    }
    throw err;
  }
  return { id, email: normalizedEmail };
}

export async function verifyUserCredentials(email: string, password: string): Promise<AuthUser | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const rows = await query<{ id: string; email: string; password_hash: string }>(
    `SELECT id, email, password_hash FROM users WHERE email = $1`,
    [normalizedEmail]
  );
  const user = rows[0];
  if (!user) return null;
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return null;
  return { id: user.id, email: user.email };
}

export async function getUserByEmail(email: string): Promise<AuthUser | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const rows = await query<{ id: string; email: string }>(
    `SELECT id, email FROM users WHERE email = $1`,
    [normalizedEmail]
  );
  return rows[0] ?? null;
}

const RESET_TOKEN_MINUTES = 30;

/** Always invalidates any earlier unused token for this user first —
 *  only the most recently requested reset link should ever work. */
export async function createPasswordResetToken(userId: string): Promise<{ token: string; expiresAt: Date }> {
  await query(`DELETE FROM password_reset_tokens WHERE user_id = $1`, [userId]);
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_MINUTES * 60 * 1000);
  await query(
    `INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES ($1, $2, $3)`,
    [token, userId, expiresAt.toISOString()]
  );
  return { token, expiresAt };
}

export async function getUserIdByResetToken(token: string): Promise<string | null> {
  const rows = await query<{ user_id: string }>(
    `SELECT user_id FROM password_reset_tokens WHERE token = $1 AND expires_at > now()`,
    [token]
  );
  return rows[0]?.user_id ?? null;
}

/** Sets a new password and, since a compromised or forgotten password
 *  is exactly the moment you want any existing session invalidated
 *  too, signs the account out everywhere. The reset token itself is
 *  single-use — deleted here regardless of whether anything else
 *  fails, so a token can never be replayed. */
export async function resetPasswordWithToken(token: string, newPassword: string): Promise<AuthUser | null> {
  const userId = await getUserIdByResetToken(token);
  if (!userId) return null;

  const passwordHash = await hashPassword(newPassword);
  const rows = await query<{ id: string; email: string }>(
    `UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id, email`,
    [passwordHash, userId]
  );
  await query(`DELETE FROM password_reset_tokens WHERE token = $1`, [token]);
  await query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
  return rows[0] ?? null;
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await query(
    `INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)`,
    [token, userId, expiresAt.toISOString()]
  );
  return { token, expiresAt };
}

export async function getUserBySessionToken(token: string): Promise<AuthUser | null> {
  const rows = await query<{ id: string; email: string }>(
    `SELECT u.id, u.email FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > now()`,
    [token]
  );
  return rows[0] ?? null;
}

export async function deleteSession(token: string): Promise<void> {
  await query(`DELETE FROM sessions WHERE token = $1`, [token]);
}

/** Server Component / Route Handler helper — reads the session cookie
 *  from the current request and resolves it to a user, or null if
 *  there's no valid session. Read-only; doesn't touch the cookie. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return await getUserBySessionToken(token);
  } catch {
    // A DB hiccup here should never take down page rendering — worst
    // case, someone sees a logged-out state for a moment.
    return null;
  }
}

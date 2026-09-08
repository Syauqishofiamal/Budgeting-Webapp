import bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'node:crypto';
import { sql, ensureUser } from './db';

// ── Account management ──────────────────────────────────────────────────────
// Real email + password accounts. Passwords are bcrypt-hashed with a work
// factor of 12; tokens are stored only as SHA-256 digests so a database leak
// cannot be replayed to seize an account.

export const BCRYPT_ROUNDS = 12;
export const MIN_PASSWORD_LENGTH = 8;

/** Attempts allowed per identifier within the window, per kind. */
const RATE_LIMITS: Record<string, { max: number; windowMinutes: number }> = {
  login:  { max: 8,  windowMinutes: 15 },
  signup: { max: 5,  windowMinutes: 60 },
  reset:  { max: 5,  windowMinutes: 60 },
};

export interface Account {
  id: string;
  email: string | null;
  displayName: string | null;
  isDemo: boolean;
  emailVerifiedAt: string | null;
}

/** Emails are matched case-insensitively, so store and compare lowercased. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Deliberately permissive: one @, something either side, a dot in the domain.
 * Over-strict patterns reject valid addresses, and the real proof an address
 * works is a delivered verification email.
 */
export function isValidEmail(email: string): boolean {
  if (email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export interface PasswordProblem { ok: false; reason: string }
export type PasswordCheck = { ok: true } | PasswordProblem;

export function checkPassword(pw: string): PasswordCheck {
  if (typeof pw !== 'string' || pw.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, reason: `Use at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  // bcrypt silently truncates past 72 bytes; reject rather than mislead.
  if (Buffer.byteLength(pw, 'utf8') > 72) {
    return { ok: false, reason: 'That password is too long (72 bytes max).' };
  }
  return { ok: true };
}

// ── Rate limiting ───────────────────────────────────────────────────────────

export async function tooManyAttempts(identifier: string, kind: keyof typeof RATE_LIMITS)
  : Promise<boolean> {
  const limit = RATE_LIMITS[kind];
  if (!limit) return false;
  const [row] = (await sql`
    SELECT COUNT(*)::int AS n FROM auth_attempts
    WHERE identifier = ${identifier} AND kind = ${kind}
      AND created_at > NOW() - (${limit.windowMinutes} * INTERVAL '1 minute')`
  ) as unknown as { n: number }[];
  return row.n >= limit.max;
}

export async function recordAttempt(identifier: string, kind: string): Promise<void> {
  await sql`INSERT INTO auth_attempts (identifier, kind) VALUES (${identifier}, ${kind})`;
  // Opportunistic cleanup so the table cannot grow without bound.
  if (Math.random() < 0.02) {
    await sql`DELETE FROM auth_attempts WHERE created_at < NOW() - INTERVAL '1 day'`;
  }
}

export async function clearAttempts(identifier: string, kind: string): Promise<void> {
  await sql`DELETE FROM auth_attempts WHERE identifier = ${identifier} AND kind = ${kind}`;
}

// ── Lookup ──────────────────────────────────────────────────────────────────

interface UserRow {
  id: string; email: string | null; password_hash: string | null;
  display_name: string | null; is_demo: boolean; email_verified_at: string | null;
}

export async function findByEmail(email: string): Promise<UserRow | null> {
  const rows = (await sql`
    SELECT id, email, password_hash, display_name, is_demo, email_verified_at
    FROM users WHERE email = ${normalizeEmail(email)}`) as unknown as UserRow[];
  return rows[0] ?? null;
}

export async function findById(id: string): Promise<UserRow | null> {
  const rows = (await sql`
    SELECT id, email, password_hash, display_name, is_demo, email_verified_at
    FROM users WHERE id = ${id}`) as unknown as UserRow[];
  return rows[0] ?? null;
}

export function toAccount(r: UserRow): Account {
  return {
    id: r.id, email: r.email, displayName: r.display_name,
    isDemo: r.is_demo, emailVerifiedAt: r.email_verified_at,
  };
}

// ── Registration ────────────────────────────────────────────────────────────

export type SignupResult =
  | { ok: true; account: Account }
  | { ok: false; error: string };

/**
 * Creates an account plus its default settings/gamification rows.
 *
 * The user id is a random token rather than the email, so changing an email
 * later never has to rewrite every foreign key in the database.
 */
export async function createAccount(
  emailRaw: string, password: string, displayName?: string | null,
): Promise<SignupResult> {
  const email = normalizeEmail(emailRaw);
  if (!isValidEmail(email)) return { ok: false, error: 'That email does not look right.' };

  const pw = checkPassword(password);
  if (!pw.ok) return { ok: false, error: pw.reason };

  if (await findByEmail(email)) {
    return { ok: false, error: 'An account with that email already exists.' };
  }

  const id = `u_${randomBytes(12).toString('hex')}`;
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // ensureUser creates the settings + gamification rows every screen expects.
  await ensureUser(id, false);
  try {
    await sql`
      UPDATE users SET email = ${email}, password_hash = ${hash},
                       display_name = ${displayName?.trim().slice(0, 60) || null}
      WHERE id = ${id}`;
  } catch {
    // Unique index collision: someone registered the same email concurrently.
    await sql`DELETE FROM users WHERE id = ${id}`;
    return { ok: false, error: 'An account with that email already exists.' };
  }

  const row = await findById(id);
  return row ? { ok: true, account: toAccount(row) } : { ok: false, error: 'Could not create the account.' };
}

// ── Login ───────────────────────────────────────────────────────────────────

/**
 * Verifies credentials. Always runs a bcrypt comparison even when no account
 * exists, so response timing does not reveal which emails are registered.
 */
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEeO1YCVFCkjPmhBqZ4nkAmLxSZFcXWQxHi';

export async function verifyLogin(emailRaw: string, password: string): Promise<Account | null> {
  const email = normalizeEmail(emailRaw);
  const row = await findByEmail(email);
  const hash = row?.password_hash ?? DUMMY_HASH;
  const ok = await bcrypt.compare(password, hash);
  if (!ok || !row || !row.password_hash) return null;

  await sql`UPDATE users SET last_login_at = NOW() WHERE id = ${row.id}`;
  return toAccount(row);
}

export async function changePassword(userId: string, newPassword: string): Promise<PasswordCheck> {
  const check = checkPassword(newPassword);
  if (!check.ok) return check;
  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${userId}`;
  // Any outstanding reset links become useless once the password changes.
  await sql`DELETE FROM auth_tokens WHERE user_id = ${userId} AND purpose = 'reset_password'`;
  return { ok: true };
}

// ── Single-use tokens (verification + password reset) ───────────────────────

export type TokenPurpose = 'verify_email' | 'reset_password';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Returns the raw token to embed in a link. Only its hash reaches the DB. */
export async function issueToken(
  userId: string, purpose: TokenPurpose, ttlMinutes: number,
): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await sql`
    INSERT INTO auth_tokens (token_hash, user_id, purpose, expires_at)
    VALUES (${hashToken(token)}, ${userId}, ${purpose},
            NOW() + (${ttlMinutes} * INTERVAL '1 minute'))`;
  return token;
}

/** Consumes a token, returning its user id, or null if invalid/expired/used. */
export async function consumeToken(token: string, purpose: TokenPurpose): Promise<string | null> {
  const rows = (await sql`
    UPDATE auth_tokens SET used_at = NOW()
    WHERE token_hash = ${hashToken(token)}
      AND purpose = ${purpose}
      AND used_at IS NULL
      AND expires_at > NOW()
    RETURNING user_id`) as unknown as { user_id: string }[];
  return rows[0]?.user_id ?? null;
}

export async function markEmailVerified(userId: string): Promise<void> {
  await sql`UPDATE users SET email_verified_at = NOW() WHERE id = ${userId}`;
}

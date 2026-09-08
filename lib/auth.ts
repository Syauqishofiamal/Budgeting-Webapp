import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

const COOKIE = 'coffer_session';
const DAY = 60 * 60 * 24;

export const DEMO_USER_ID = 'demo';
export const OWNER_USER_ID = 'owner';

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error('AUTH_SECRET must be set to at least 32 characters.');
  }
  return new TextEncoder().encode(s);
}

export interface Session { userId: string; isDemo: boolean; }

export async function createSession(userId: string, isDemo: boolean): Promise<void> {
  const token = await new SignJWT({ userId, isDemo })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(isDemo ? '1d' : '30d')
    .sign(secret());

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: isDemo ? DAY : DAY * 30,
  });
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return { userId: String(payload.userId), isDemo: Boolean(payload.isDemo) };
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** Constant-time-ish owner check via bcrypt. */
export async function verifyOwner(username: string, password: string): Promise<boolean> {
  const expectedUser = process.env.OWNER_USERNAME;
  const hash = process.env.OWNER_PASSWORD_HASH;
  if (!expectedUser || !hash) return false;
  // Always run bcrypt so a wrong username isn't faster than a wrong password.
  const userOk = username === expectedUser;
  const passOk = await bcrypt.compare(password, hash);
  return userOk && passOk;
}

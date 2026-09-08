import { NextResponse } from 'next/server';
import { verifyOwner, createSession, OWNER_USER_ID } from '@/lib/auth';
import { ensureUser } from '@/lib/db';
import { verifyLogin, tooManyAttempts, recordAttempt, clearAttempts,
         normalizeEmail } from '@/lib/accounts';
import { clientIp } from '@/lib/request-ip';

/**
 * Accepts either an email (real accounts) or the legacy OWNER_USERNAME.
 * The field is named `email` but the legacy username is still honoured so the
 * original account keeps working after the migration.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const identifier = typeof body.email === 'string' ? body.email
                   : typeof body.username === 'string' ? body.username : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!identifier || !password) {
    return NextResponse.json({ error: 'Enter your email and password.' }, { status: 400 });
  }

  // Throttle per-email and per-IP so neither a targeted nor a broad attack
  // gets unlimited guesses.
  const emailKey = `email:${normalizeEmail(identifier)}`;
  const ipKey = `ip:${clientIp(req)}`;
  if (await tooManyAttempts(emailKey, 'login') || await tooManyAttempts(ipKey, 'login')) {
    return NextResponse.json(
      { error: 'Too many attempts. Wait a few minutes and try again.' }, { status: 429 });
  }
  await recordAttempt(emailKey, 'login');
  await recordAttempt(ipKey, 'login');

  // Real account first.
  const account = await verifyLogin(identifier, password);
  if (account) {
    await clearAttempts(emailKey, 'login');
    await createSession(account.id, false);
    return NextResponse.json({ ok: true, account });
  }

  // Legacy env-var owner.
  if (await verifyOwner(identifier, password)) {
    await clearAttempts(emailKey, 'login');
    await ensureUser(OWNER_USER_ID, false);
    await createSession(OWNER_USER_ID, false);
    return NextResponse.json({ ok: true });
  }

  // One message for both cases: never reveal whether an email is registered.
  return NextResponse.json({ error: 'Wrong email or password.' }, { status: 401 });
}

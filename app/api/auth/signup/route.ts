import { NextResponse } from 'next/server';
import { createAccount, tooManyAttempts, recordAttempt, normalizeEmail,
         issueToken } from '@/lib/accounts';
import { createSession } from '@/lib/auth';
import { clientIp } from '@/lib/request-ip';
import { sendVerificationEmail } from '@/lib/email';

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (await tooManyAttempts(ip, 'signup')) {
    return NextResponse.json(
      { error: 'Too many signups from here. Try again later.' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  const email = typeof body.email === 'string' ? body.email : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const displayName = typeof body.displayName === 'string' ? body.displayName : null;

  await recordAttempt(ip, 'signup');

  const result = await createAccount(email, password, displayName);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  // Signing in immediately keeps the first run frictionless. Verification is a
  // follow-up, not a gate — an unverified account can still use the app.
  await createSession(result.account.id, false);

  // Fire-and-forget: a mail outage must not break signup.
  try {
    const token = await issueToken(result.account.id, 'verify_email', 60 * 24);
    await sendVerificationEmail(normalizeEmail(email), token);
  } catch { /* verification can be re-requested later */ }

  return NextResponse.json({ ok: true, account: result.account });
}

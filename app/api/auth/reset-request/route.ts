import { NextResponse } from 'next/server';
import { findByEmail, issueToken, tooManyAttempts, recordAttempt,
         normalizeEmail } from '@/lib/accounts';
import { sendPasswordResetEmail } from '@/lib/email';
import { clientIp } from '@/lib/request-ip';

/**
 * Always answers "check your inbox", whether or not the address exists.
 * Confirming which emails are registered would leak the user list.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? normalizeEmail(body.email) : '';

  const ok = NextResponse.json({
    ok: true,
    message: 'If that email has an account, a reset link is on its way.',
  });

  if (!email) return ok;

  const ipKey = `ip:${clientIp(req)}`;
  if (await tooManyAttempts(ipKey, 'reset')) return ok; // stay silent
  await recordAttempt(ipKey, 'reset');

  const user = await findByEmail(email);
  if (!user) return ok;

  try {
    const token = await issueToken(user.id, 'reset_password', 60);
    await sendPasswordResetEmail(email, token);
  } catch { /* never surface mail failures to the caller */ }

  return ok;
}

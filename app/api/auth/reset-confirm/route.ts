import { NextResponse } from 'next/server';
import { consumeToken, changePassword } from '@/lib/accounts';
import { createSession } from '@/lib/auth';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = typeof body.token === 'string' ? body.token : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!token) return NextResponse.json({ error: 'Missing reset token.' }, { status: 400 });

  const userId = await consumeToken(token, 'reset_password');
  if (!userId) {
    return NextResponse.json(
      { error: 'That reset link is invalid or has expired.' }, { status: 400 });
  }

  const result = await changePassword(userId, password);
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 });

  // Sign them straight in — they have just proven control of the inbox.
  await createSession(userId, false);
  return NextResponse.json({ ok: true });
}

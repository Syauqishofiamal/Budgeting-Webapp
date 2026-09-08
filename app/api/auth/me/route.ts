import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { findById, toAccount, changePassword, verifyLogin } from '@/lib/accounts';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const row = await findById(session.userId);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ account: toAccount(row) });
}

/** Change password while signed in. Requires the current one. */
export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  if (session.isDemo) {
    return NextResponse.json({ error: 'The demo account cannot be changed.' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const current = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const next = typeof body.newPassword === 'string' ? body.newPassword : '';

  const row = await findById(session.userId);
  if (!row?.email) {
    return NextResponse.json(
      { error: 'This account signs in with environment variables, not a stored password.' },
      { status: 400 });
  }

  // Re-check the current password so a stolen session cannot lock the owner out.
  if (!(await verifyLogin(row.email, current))) {
    return NextResponse.json({ error: 'Your current password is not right.' }, { status: 401 });
  }

  const result = await changePassword(session.userId, next);
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 });
  return NextResponse.json({ ok: true });
}

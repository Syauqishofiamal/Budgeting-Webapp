import { NextResponse } from 'next/server';
import { verifyOwner, createSession, OWNER_USER_ID } from '@/lib/auth';
import { ensureUser } from '@/lib/db';

export async function POST(req: Request) {
  const { username, password } = await req.json().catch(() => ({}));
  if (typeof username !== 'string' || typeof password !== 'string') {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
  }
  if (!(await verifyOwner(username, password))) {
    return NextResponse.json({ error: 'Wrong username or password' }, { status: 401 });
  }
  await ensureUser(OWNER_USER_ID, false);
  await createSession(OWNER_USER_ID, false);
  return NextResponse.json({ ok: true });
}

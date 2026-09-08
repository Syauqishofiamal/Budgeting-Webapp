import { NextResponse } from 'next/server';
import { createSession, DEMO_USER_ID } from '@/lib/auth';
import { ensureDemoSeeded } from '@/lib/demo';

export async function POST() {
  await ensureDemoSeeded();
  await createSession(DEMO_USER_ID, true);
  return NextResponse.json({ ok: true });
}

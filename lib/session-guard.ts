import { NextResponse } from 'next/server';
import { getSession, type Session } from './auth';
import { getSettings } from './db';
import { localDateStr } from './dates';

export interface Ctx { session: Session; today: string; }

/** Resolves session + the user's local 'today'. Returns a 401 response if absent. */
export async function requireSession(): Promise<Ctx | NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  let tz = process.env.DEFAULT_LOCALE || 'Asia/Kuala_Lumpur';
  try {
    const s = await getSettings(session.userId);
    if (s?.locale) tz = s.locale;
  } catch { /* fall back to default tz */ }
  return { session, today: localDateStr(new Date(), tz) };
}

export function isResponse(v: unknown): v is NextResponse {
  return v instanceof NextResponse;
}

import { NextResponse } from 'next/server';
import { consumeToken, markEmailVerified } from '@/lib/accounts';

/** Landed on from the emailed link, so this redirects rather than returns JSON. */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token') ?? '';
  const userId = token ? await consumeToken(token, 'verify_email') : null;

  if (!userId) {
    return NextResponse.redirect(new URL('/?verified=expired', req.url));
  }
  await markEmailVerified(userId);
  return NextResponse.redirect(new URL('/?verified=1', req.url));
}

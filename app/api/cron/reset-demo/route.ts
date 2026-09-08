import { NextResponse } from 'next/server';
import { seedDemo } from '@/lib/demo';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Nightly reset of the SHARED demo account (see vercel.json crons).
 * Because every visitor shares one demo login, it fills with test junk;
 * this wipes and reseeds it so the next recruiter sees clean sample data.
 * Protected by CRON_SECRET — Vercel sends it as a Bearer token.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }
  await seedDemo();
  return NextResponse.json({ ok: true, reseededAt: new Date().toISOString() });
}

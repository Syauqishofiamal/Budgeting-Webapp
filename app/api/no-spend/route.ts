import { NextResponse } from 'next/server';
import { requireSession, isResponse } from '@/lib/session-guard';
import { sql } from '@/lib/db';
import { logNoSpend } from '@/lib/actions';

/** "No spending today" is a first-class tracking act, worth full XP. */
export async function POST(req: Request) {
  const ctx = await requireSession();
  if (isResponse(ctx)) return ctx;
  const body = await req.json().catch(() => ({}));
  const date = /^\d{4}-\d{2}-\d{2}$/.test(body?.date) ? body.date : ctx.today;

  const [has] = (await sql`
    SELECT COUNT(*)::int AS n FROM expenses
    WHERE user_id = ${ctx.session.userId} AND date = ${date}`) as unknown as { n: number }[];
  if (has.n > 0) {
    return NextResponse.json({ error: 'That day already has expenses logged' }, { status: 400 });
  }
  const result = await logNoSpend(ctx.session.userId, date, ctx.today);
  return NextResponse.json(result);
}

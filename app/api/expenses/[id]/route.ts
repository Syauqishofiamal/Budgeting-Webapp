import { NextResponse } from 'next/server';
import { requireSession, isResponse } from '@/lib/session-guard';
import { sql } from '@/lib/db';

type Params = { params: Promise<{ id: string }> };

/** Edit. Deliberately does NOT touch XP or streak — correcting a typo is not
 *  new activity, and shouldn't hand out or claw back rewards. */
export async function PATCH(req: Request, { params }: Params) {
  const ctx = await requireSession();
  if (isResponse(ctx)) return ctx;
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Bad JSON' }, { status: 400 });

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000) {
    return NextResponse.json({ error: 'Amount out of range' }, { status: 400 });
  }
  const note = body.note ? String(body.note).slice(0, 280).trim() || null : null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : null;

  const [row] = (await sql`
    UPDATE expenses SET
      amount = ${Math.round(amount * 100) / 100},
      note = ${note},
      date = COALESCE(${date}::date, date)
    WHERE id = ${id} AND user_id = ${ctx.session.userId}
    RETURNING id`) as unknown as { id: number }[];
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

/** Permanent delete from the list view. Unlike Undo this keeps XP already
 *  earned — the day genuinely happened; you're just removing a wrong row. */
export async function DELETE(_req: Request, { params }: Params) {
  const ctx = await requireSession();
  if (isResponse(ctx)) return ctx;
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });

  const [row] = (await sql`
    DELETE FROM expenses WHERE id = ${id} AND user_id = ${ctx.session.userId}
    RETURNING id`) as unknown as { id: number }[];
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await sql`DELETE FROM xp_events WHERE user_id = ${ctx.session.userId} AND expense_id = ${id}`;
  return NextResponse.json({ ok: true });
}

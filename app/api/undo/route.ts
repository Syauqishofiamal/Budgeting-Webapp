import { NextResponse } from 'next/server';
import { requireSession, isResponse } from '@/lib/session-guard';
import { undoExpense } from '@/lib/actions';

/** Undo the just-saved entry: removes it and restores the exact prior
 *  XP / streak / badge snapshot, so it never counted as activity. */
export async function POST(req: Request) {
  const ctx = await requireSession();
  if (isResponse(ctx)) return ctx;
  const { expenseId } = await req.json().catch(() => ({}));
  const id = Number(expenseId);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });
  const ok = await undoExpense(ctx.session.userId, id);
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

import { NextResponse } from 'next/server';
import { requireSession, isResponse } from '@/lib/session-guard';
import { sql, recentAmounts, toDateStr } from '@/lib/db';
import { logExpense } from '@/lib/actions';
import { chipModeFor, MAX_CHIPS_FULL, MAX_CHIPS_APPROX, CATEGORY_MAP } from '@/lib/constants';

/** GET /api/expenses?chips=transport&subtype=... → recent amount chips */
export async function GET(req: Request) {
  const ctx = await requireSession();
  if (isResponse(ctx)) return ctx;

  const url = new URL(req.url);
  const category = url.searchParams.get('chips');
  if (category) {
    const subtype = url.searchParams.get('subtype');
    const mode = chipModeFor(category, subtype);
    const limit = mode === 'full' ? MAX_CHIPS_FULL : MAX_CHIPS_APPROX;
    const amounts = await recentAmounts(ctx.session.userId, category, subtype, limit);
    return NextResponse.json({ amounts, mode });
  }

  const date = url.searchParams.get('date') ?? ctx.today;
  const rows = (await sql`
    SELECT id, date, category, custom_label, subtype, amount, note, created_at
    FROM expenses WHERE user_id = ${ctx.session.userId} AND date = ${date}
    ORDER BY created_at DESC`) as unknown as Record<string, unknown>[];
  return NextResponse.json({
    expenses: rows.map((r) => ({ ...r, date: toDateStr(r.date), amount: Number(r.amount) })),
  });
}

export async function POST(req: Request) {
  const ctx = await requireSession();
  if (isResponse(ctx)) return ctx;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Bad JSON' }, { status: 400 });

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000) {
    return NextResponse.json({ error: 'Amount must be between 0 and 1,000,000' }, { status: 400 });
  }
  const category = String(body.category ?? '');
  if (!CATEGORY_MAP[category]) {
    return NextResponse.json({ error: 'Unknown category' }, { status: 400 });
  }
  const date = /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : ctx.today;
  if (date > ctx.today) {
    return NextResponse.json({ error: 'Cannot log a future date' }, { status: 400 });
  }
  const customLabel = category === 'custom'
    ? String(body.customLabel ?? '').slice(0, 60).trim() || null : null;
  if (category === 'custom' && !customLabel) {
    return NextResponse.json({ error: 'Custom entries need a label' }, { status: 400 });
  }
  const subtype = category === 'food' && (body.subtype === 'delivery' || body.subtype === 'cooked')
    ? body.subtype : null;
  const note = body.note ? String(body.note).slice(0, 280).trim() || null : null;

  const result = await logExpense(
    ctx.session.userId,
    { date, category, customLabel, subtype, amount: Math.round(amount * 100) / 100, note },
    ctx.today,
  );
  return NextResponse.json(result);
}

import { NextResponse } from 'next/server';
import { requireSession, isResponse } from '@/lib/session-guard';
import { sql, toDateStr } from '@/lib/db';
import { CATEGORY_MAP } from '@/lib/constants';

export async function GET() {
  const ctx = await requireSession();
  if (isResponse(ctx)) return ctx;
  const rows = (await sql`
    SELECT id, category, custom_label, last_amount::float8 AS last_amount, last_logged
    FROM recurring WHERE user_id = ${ctx.session.userId} ORDER BY category`
  ) as unknown as Record<string, unknown>[];
  return NextResponse.json({
    recurring: rows.map((r) => ({ ...r, last_logged: r.last_logged ? toDateStr(r.last_logged) : null })),
  });
}

/** Create a bill template. Bills NEVER auto-log — see README rationale. */
export async function POST(req: Request) {
  const ctx = await requireSession();
  if (isResponse(ctx)) return ctx;
  const b = await req.json().catch(() => ({}));
  const category = String(b.category ?? '');
  const amount = Number(b.amount);
  if (!CATEGORY_MAP[category]) {
    return NextResponse.json({ error: 'Unknown category' }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000) {
    return NextResponse.json({ error: 'Amount out of range' }, { status: 400 });
  }
  const label = category === 'custom'
    ? String(b.customLabel ?? '').slice(0, 60).trim() || null : null;

  const [row] = (await sql`
    INSERT INTO recurring (user_id, category, custom_label, last_amount)
    VALUES (${ctx.session.userId}, ${category}, ${label}, ${amount})
    RETURNING id`) as unknown as { id: number }[];
  return NextResponse.json({ id: row.id });
}

export async function DELETE(req: Request) {
  const ctx = await requireSession();
  if (isResponse(ctx)) return ctx;
  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });
  await sql`DELETE FROM recurring WHERE id = ${id} AND user_id = ${ctx.session.userId}`;
  return NextResponse.json({ ok: true });
}

import { NextResponse } from 'next/server';
import { requireSession, isResponse } from '@/lib/session-guard';
import { sql, toDateStr } from '@/lib/db';
import { monthOf, monthBounds } from '@/lib/dates';

/** GET /api/history?month=YYYY-MM&category=slug */
export async function GET(req: Request) {
  const ctx = await requireSession();
  if (isResponse(ctx)) return ctx;
  const url = new URL(req.url);
  const month = /^\d{4}-\d{2}$/.test(url.searchParams.get('month') ?? '')
    ? url.searchParams.get('month')! : monthOf(ctx.today);
  const category = url.searchParams.get('category');
  const { start, end } = monthBounds(month);

  const rows = (await sql`
    SELECT id, date, category, custom_label, subtype, amount::float8 AS amount, note, created_at
    FROM expenses
    WHERE user_id = ${ctx.session.userId}
      AND date BETWEEN ${start} AND ${end}
      AND (${category}::text IS NULL OR category = ${category})
    ORDER BY date DESC, created_at DESC`) as unknown as Record<string, unknown>[];

  const [total] = (await sql`
    SELECT COALESCE(SUM(amount), 0)::float8 AS total FROM expenses
    WHERE user_id = ${ctx.session.userId}
      AND date BETWEEN ${start} AND ${end}
      AND (${category}::text IS NULL OR category = ${category})`) as unknown as { total: number }[];

  const months = (await sql`
    SELECT DISTINCT to_char(date, 'YYYY-MM') AS m FROM expenses
    WHERE user_id = ${ctx.session.userId} ORDER BY m DESC`) as unknown as { m: string }[];

  return NextResponse.json({
    month, category, total: total.total,
    availableMonths: months.map((r) => r.m),
    expenses: rows.map((r) => ({ ...r, date: toDateStr(r.date) })),
  });
}

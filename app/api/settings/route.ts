import { NextResponse } from 'next/server';
import { requireSession, isResponse } from '@/lib/session-guard';
import { sql } from '@/lib/db';

export async function PATCH(req: Request) {
  const ctx = await requireSession();
  if (isResponse(ctx)) return ctx;
  const b = await req.json().catch(() => ({}));

  const budget = b.monthlyBudget !== undefined ? Number(b.monthlyBudget) : null;
  if (budget !== null && (!Number.isFinite(budget) || budget < 0 || budget > 10_000_000)) {
    return NextResponse.json({ error: 'Budget out of range' }, { status: 400 });
  }
  const currency = typeof b.currency === 'string' ? b.currency.slice(0, 8).toUpperCase() : null;
  const sound = typeof b.soundEnabled === 'boolean' ? b.soundEnabled : null;
  const haptics = typeof b.hapticsEnabled === 'boolean' ? b.hapticsEnabled : null;

  await sql`
    UPDATE settings SET
      monthly_budget  = COALESCE(${budget}::numeric, monthly_budget),
      currency        = COALESCE(${currency}::text, currency),
      sound_enabled   = COALESCE(${sound}::boolean, sound_enabled),
      haptics_enabled = COALESCE(${haptics}::boolean, haptics_enabled),
      updated_at = NOW()
    WHERE user_id = ${ctx.session.userId}`;
  return NextResponse.json({ ok: true });
}

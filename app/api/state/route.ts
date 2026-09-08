import { NextResponse } from 'next/server';
import { requireSession, isResponse } from '@/lib/session-guard';
import { sql, getSettings, getGamification, getBadges, toDateStr } from '@/lib/db';
import { levelProgress } from '@/lib/gamification';
import { monthOf, monthBounds } from '@/lib/dates';
import { ensureWeeklyQuests, refreshQuests, listQuests } from '@/lib/quests';

/** Everything the dashboard needs, in one round trip. */
export async function GET() {
  const ctx = await requireSession();
  if (isResponse(ctx)) return ctx;
  const uid = ctx.session.userId;
  const month = monthOf(ctx.today);
  const { start, end } = monthBounds(month);

  await ensureWeeklyQuests(uid, ctx.today);
  await refreshQuests(uid, ctx.today);

  const [settings, gam, badges, quests] = await Promise.all([
    getSettings(uid), getGamification(uid), getBadges(uid), listQuests(uid, ctx.today),
  ]);

  const [monthTotal] = (await sql`
    SELECT COALESCE(SUM(amount), 0)::float8 AS total FROM expenses
    WHERE user_id = ${uid} AND date BETWEEN ${start} AND ${end}`) as unknown as { total: number }[];

  const byCategory = (await sql`
    SELECT category, subtype, COALESCE(SUM(amount), 0)::float8 AS total, COUNT(*)::int AS n
    FROM expenses WHERE user_id = ${uid} AND date BETWEEN ${start} AND ${end}
    GROUP BY category, subtype ORDER BY total DESC`) as unknown as
    { category: string; subtype: string | null; total: number; n: number }[];

  const todayRows = (await sql`
    SELECT id, date, category, custom_label, subtype, amount::float8 AS amount, note, created_at
    FROM expenses WHERE user_id = ${uid} AND date = ${ctx.today}
    ORDER BY created_at DESC`) as unknown as Record<string, unknown>[];

  const [todayTotal] = (await sql`
    SELECT COALESCE(SUM(amount), 0)::float8 AS total FROM expenses
    WHERE user_id = ${uid} AND date = ${ctx.today}`) as unknown as { total: number }[];

  const [noSpendToday] = (await sql`
    SELECT COUNT(*)::int AS n FROM no_spend_days
    WHERE user_id = ${uid} AND date = ${ctx.today}`) as unknown as { n: number }[];

  const recurring = (await sql`
    SELECT id, category, custom_label, last_amount::float8 AS last_amount, last_logged
    FROM recurring WHERE user_id = ${uid} ORDER BY category`) as unknown as Record<string, unknown>[];

  const budget = Number(settings.monthly_budget);
  return NextResponse.json({
    today: ctx.today,
    isDemo: ctx.session.isDemo,
    settings: {
      monthlyBudget: budget,
      currency: settings.currency,
      locale: settings.locale,
      soundEnabled: settings.sound_enabled,
      hapticsEnabled: settings.haptics_enabled,
    },
    budget: {
      total: budget,
      spent: monthTotal.total,
      remaining: budget - monthTotal.total,
      // Clamped 0..1 for the gauge fill; overspend is shown as a separate note,
      // never as a red alarm.
      fraction: budget > 0 ? Math.max(0, Math.min(1, (budget - monthTotal.total) / budget)) : 0,
      over: monthTotal.total > budget,
    },
    xp: { total: gam.total_xp, ...levelProgress(gam.total_xp) },
    streak: {
      current: gam.current_streak,
      longest: gam.longest_streak,
      lastActive: gam.last_active_date,
      freezeAvailable: gam.freezes_used_month !== month,
    },
    badges,
    quests,
    todayTotal: todayTotal.total,
    noSpendToday: noSpendToday.n > 0,
    todayExpenses: todayRows.map((r) => ({ ...r, date: toDateStr(r.date) })),
    byCategory,
    recurring: recurring.map((r) => ({ ...r, last_logged: r.last_logged ? toDateStr(r.last_logged) : null })),
  });
}

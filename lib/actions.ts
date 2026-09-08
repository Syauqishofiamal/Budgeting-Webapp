import { sql, getGamification, getBadges, toDateStr } from './db';
import {
  XP_PER_ENTRY, XP_FIRST_ENTRY_OF_DAY, XP_NO_SPEND_DAY, XP_BADGE_UNLOCK,
  advanceStreak, levelFromXp, type StreakState,
} from './gamification';
import { evaluateBadges } from './badges';
import { monthOf, daysInMonth, monthBounds } from './dates';

export interface LogResult {
  expenseId: number | null;
  xpGained: number;
  totalXp: number;
  levelBefore: number;
  levelAfter: number;
  leveledUp: boolean;
  streak: number;
  streakIncremented: boolean;
  freezeApplied: boolean;
  newBadges: string[];
}

/** Snapshot of everything a single action can mutate, for exact rollback. */
interface Snapshot {
  total_xp: number;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
  freezes_used_month: string | null;
  badges: string[];
}

async function snapshotOf(userId: string): Promise<Snapshot> {
  const g = await getGamification(userId);
  const badges = await getBadges(userId);
  return {
    total_xp: g.total_xp,
    current_streak: g.current_streak,
    longest_streak: g.longest_streak,
    last_active_date: g.last_active_date,
    freezes_used_month: g.freezes_used_month,
    badges,
  };
}

async function badgeContext(userId: string, today: string, streak: number) {
  const [[entries], [nsd], [quests]] = await Promise.all([
    sql`SELECT COUNT(*)::int AS n FROM expenses WHERE user_id = ${userId}`,
    sql`SELECT COUNT(*)::int AS n FROM no_spend_days WHERE user_id = ${userId}`,
    sql`SELECT COUNT(*)::int AS n FROM quests WHERE user_id = ${userId} AND completed_at IS NOT NULL`,
  ] as unknown as Promise<{ n: number }[]>[]);

  // "Month fully logged" = every day of a COMPLETED month has an expense or a
  // no-spend marker. The current month can't qualify until it ends, so we
  // always evaluate the PREVIOUS month (day 0 of this month = last day of it).
  const month = monthOf(today);
  const prevMonth = monthOf(
    new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7) - 1, 0))
      .toISOString().slice(0, 10),
  );
  const { start, end } = monthBounds(prevMonth);
  const [cov] = (await sql`
    SELECT COUNT(DISTINCT d)::int AS n FROM (
      SELECT date AS d FROM expenses WHERE user_id = ${userId} AND date BETWEEN ${start} AND ${end}
      UNION
      SELECT date AS d FROM no_spend_days WHERE user_id = ${userId} AND date BETWEEN ${start} AND ${end}
    ) t`) as unknown as { n: number }[];
  const monthFullyLogged = cov.n >= daysInMonth(prevMonth) && cov.n > 0;

  const [spent] = (await sql`
    SELECT COALESCE(SUM(amount), 0)::float8 AS total FROM expenses
    WHERE user_id = ${userId} AND date BETWEEN ${start} AND ${end}`) as unknown as { total: number }[];
  const [budgetRow] = (await sql`
    SELECT monthly_budget::float8 AS b FROM settings WHERE user_id = ${userId}`) as unknown as { b: number }[];
  const monthUnderBudget = monthFullyLogged && spent.total > 0 && spent.total <= budgetRow.b;

  return {
    totalEntries: entries.n,
    currentStreak: streak,
    noSpendDays: nsd.n,
    questsCompleted: quests.n,
    monthFullyLogged,
    monthUnderBudget,
  };
}

/**
 * Apply XP + streak + badges for an activity on `today`.
 * Shared by expense logging and no-spend days.
 */
async function applyActivity(
  userId: string, today: string, baseXp: number, expenseId: number | null, kind: string,
): Promise<LogResult> {
  const before = await snapshotOf(userId);
  const levelBefore = levelFromXp(before.total_xp);

  const prevState: StreakState = {
    current: before.current_streak,
    longest: before.longest_streak,
    lastActiveDate: before.last_active_date,
    freezesUsedMonth: before.freezes_used_month,
    freezeUsedInMonth: before.freezes_used_month === monthOf(today),
  };
  const streakResult = advanceStreak(prevState, today);

  // First activity of the day earns the "showed up" bonus on top of base XP.
  const isFirstToday = before.last_active_date !== today;
  let xpGained = baseXp + (isFirstToday && kind === 'expense' ? XP_FIRST_ENTRY_OF_DAY : 0);

  let totalXp = before.total_xp + xpGained;

  // Badges are evaluated AFTER the streak advances so streak_7 fires same-day.
  const ctx = await badgeContext(userId, today, streakResult.state.current);
  const earned = evaluateBadges(ctx);
  const newBadges = earned.filter((b) => !before.badges.includes(b));
  if (newBadges.length) {
    xpGained += newBadges.length * XP_BADGE_UNLOCK;
    totalXp += newBadges.length * XP_BADGE_UNLOCK;
    for (const slug of newBadges) {
      await sql`INSERT INTO badges (user_id, slug) VALUES (${userId}, ${slug})
                ON CONFLICT DO NOTHING`;
    }
  }

  await sql`
    UPDATE gamification SET
      total_xp = ${totalXp},
      current_streak = ${streakResult.state.current},
      longest_streak = ${streakResult.state.longest},
      last_active_date = ${streakResult.state.lastActiveDate},
      freezes_used_month = ${streakResult.state.freezesUsedMonth},
      updated_at = NOW()
    WHERE user_id = ${userId}`;

  await sql`
    INSERT INTO xp_events (user_id, expense_id, kind, xp_delta, snapshot)
    VALUES (${userId}, ${expenseId}, ${kind}, ${xpGained}, ${JSON.stringify(before)})`;

  const levelAfter = levelFromXp(totalXp);
  return {
    expenseId,
    xpGained,
    totalXp,
    levelBefore,
    levelAfter,
    leveledUp: levelAfter > levelBefore,
    streak: streakResult.state.current,
    streakIncremented: streakResult.incremented,
    freezeApplied: streakResult.freezeApplied,
    newBadges,
  };
}

export interface NewExpense {
  date: string;
  category: string;
  customLabel?: string | null;
  subtype?: string | null;
  amount: number;
  note?: string | null;
}

export async function logExpense(userId: string, e: NewExpense, today: string): Promise<LogResult> {
  const [row] = (await sql`
    INSERT INTO expenses (user_id, date, category, custom_label, subtype, amount, note)
    VALUES (${userId}, ${e.date}, ${e.category}, ${e.customLabel ?? null},
            ${e.subtype ?? null}, ${e.amount}, ${e.note ?? null})
    RETURNING id`) as unknown as { id: number }[];

  // Streak credit follows the day you LOGGED (today), not a backdated entry —
  // otherwise backfilling last week would inflate the current run.
  const result = await applyActivity(userId, today, XP_PER_ENTRY, row.id, 'expense');

  // Keep the recurring template's remembered amount fresh.
  await sql`
    UPDATE recurring SET last_amount = ${e.amount}, last_logged = ${e.date}
    WHERE user_id = ${userId} AND category = ${e.category}`;

  return result;
}

export async function logNoSpend(userId: string, date: string, today: string): Promise<LogResult> {
  await sql`
    INSERT INTO no_spend_days (user_id, date) VALUES (${userId}, ${date})
    ON CONFLICT DO NOTHING`;
  return applyActivity(userId, today, XP_NO_SPEND_DAY, null, 'no_spend');
}

/**
 * Undo: delete the entry and RESTORE the pre-save snapshot verbatim.
 * Restoring beats recomputing — it guarantees XP, streak, longest streak,
 * freeze allowance and badge set land exactly where they were, so an undone
 * save never counts as streak activity.
 */
export async function undoExpense(userId: string, expenseId: number): Promise<boolean> {
  const [ev] = (await sql`
    SELECT snapshot FROM xp_events
    WHERE user_id = ${userId} AND expense_id = ${expenseId}
    ORDER BY id DESC LIMIT 1`) as unknown as { snapshot: Snapshot }[];

  const [del] = (await sql`
    DELETE FROM expenses WHERE id = ${expenseId} AND user_id = ${userId}
    RETURNING id`) as unknown as { id: number }[];
  if (!del) return false;

  if (ev?.snapshot) {
    const s = ev.snapshot;
    await sql`
      UPDATE gamification SET
        total_xp = ${s.total_xp},
        current_streak = ${s.current_streak},
        longest_streak = ${s.longest_streak},
        last_active_date = ${s.last_active_date},
        freezes_used_month = ${s.freezes_used_month},
        updated_at = NOW()
      WHERE user_id = ${userId}`;
    // Remove any badge this action unlocked; keep everything earned earlier.
    await sql`
      DELETE FROM badges WHERE user_id = ${userId}
      AND slug <> ALL(${s.badges.length ? s.badges : ['']}::text[])`;
  }

  await sql`DELETE FROM xp_events WHERE user_id = ${userId} AND expense_id = ${expenseId}`;
  return true;
}

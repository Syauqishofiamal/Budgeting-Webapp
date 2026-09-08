import { sql } from './db';
import { weekStart, addDays } from './dates';
import { XP_QUEST_COMPLETE } from './gamification';

// ── Weekly quests ───────────────────────────────────────────────────────────
// 2–3 at a time, generated from the user's OWN data so targets are achievable.
// All are framed as things to DO, never things to avoid. Completing grants XP.

export interface Quest {
  slug: string; title: string; target: number; progress: number; completed: boolean;
}

/** Build this week's quest set from the trailing 4 weeks of behaviour. */
export async function ensureWeeklyQuests(userId: string, today: string): Promise<void> {
  const ws = weekStart(today);
  const [existing] = (await sql`
    SELECT COUNT(*)::int AS n FROM quests WHERE user_id = ${userId} AND week_start = ${ws}`
  ) as unknown as { n: number }[];
  if (existing.n > 0) return;

  const since = addDays(ws, -28);
  const [cooked] = (await sql`
    SELECT COUNT(*)::int AS n FROM expenses
    WHERE user_id = ${userId} AND category = 'food' AND subtype = 'cooked' AND date >= ${since}`
  ) as unknown as { n: number }[];
  const [transport] = (await sql`
    SELECT COALESCE(AVG(w.total), 0)::float8 AS avg FROM (
      SELECT SUM(amount)::float8 AS total FROM expenses
      WHERE user_id = ${userId} AND category = 'transport' AND date >= ${since}
      GROUP BY date_trunc('week', date)
    ) w`) as unknown as { avg: number }[];

  // Targets sit slightly above recent behaviour: reachable, not trivial.
  const cookedTarget = Math.max(2, Math.min(5, Math.round(cooked.n / 4) + 1));
  const transportTarget = transport.avg > 0 ? Math.round(transport.avg * 1.1) : 60;

  const quests = [
    { slug: 'log_days',  title: 'Log on 5 days this week',                target: 5 },
    { slug: 'cook',      title: `Log ${cookedTarget} home-cooked meals`,  target: cookedTarget },
    { slug: 'transport', title: `Keep transport under ${transportTarget}`, target: transportTarget },
  ];

  for (const q of quests) {
    await sql`
      INSERT INTO quests (user_id, week_start, slug, title, target)
      VALUES (${userId}, ${ws}, ${q.slug}, ${q.title}, ${q.target})
      ON CONFLICT DO NOTHING`;
  }
}

/** Recompute progress from live data and mark completions. Returns newly done. */
export async function refreshQuests(userId: string, today: string): Promise<string[]> {
  const ws = weekStart(today);
  const wEnd = addDays(ws, 6);

  const [days] = (await sql`
    SELECT COUNT(DISTINCT d)::int AS n FROM (
      SELECT date AS d FROM expenses WHERE user_id = ${userId} AND date BETWEEN ${ws} AND ${wEnd}
      UNION
      SELECT date AS d FROM no_spend_days WHERE user_id = ${userId} AND date BETWEEN ${ws} AND ${wEnd}
    ) t`) as unknown as { n: number }[];
  const [cooked] = (await sql`
    SELECT COUNT(*)::int AS n FROM expenses WHERE user_id = ${userId}
    AND category = 'food' AND subtype = 'cooked' AND date BETWEEN ${ws} AND ${wEnd}`
  ) as unknown as { n: number }[];
  const [tspend] = (await sql`
    SELECT COALESCE(SUM(amount), 0)::float8 AS total FROM expenses
    WHERE user_id = ${userId} AND category = 'transport' AND date BETWEEN ${ws} AND ${wEnd}`
  ) as unknown as { total: number }[];

  const progress: Record<string, number> = {
    log_days: days.n, cook: cooked.n, transport: tspend.total,
  };

  const rows = (await sql`
    SELECT slug, target::float8 AS target, completed_at FROM quests
    WHERE user_id = ${userId} AND week_start = ${ws}`
  ) as unknown as { slug: string; target: number; completed_at: string | null }[];

  const newlyDone: string[] = [];
  for (const r of rows) {
    const p = progress[r.slug] ?? 0;
    // "transport" is an under-target quest and only resolves at week's end;
    // the others complete as soon as the count is reached.
    const done = r.slug === 'transport'
      ? today >= wEnd && p <= r.target
      : p >= r.target;

    if (done && !r.completed_at) {
      newlyDone.push(r.slug);
      await sql`UPDATE quests SET progress = ${p}, completed_at = NOW()
                WHERE user_id = ${userId} AND week_start = ${ws} AND slug = ${r.slug}`;
      await sql`UPDATE gamification SET total_xp = total_xp + ${XP_QUEST_COMPLETE}
                WHERE user_id = ${userId}`;
    } else {
      await sql`UPDATE quests SET progress = ${p}
                WHERE user_id = ${userId} AND week_start = ${ws} AND slug = ${r.slug}`;
    }
  }
  return newlyDone;
}

export async function listQuests(userId: string, today: string): Promise<Quest[]> {
  const ws = weekStart(today);
  const rows = (await sql`
    SELECT slug, title, target::float8 AS target, progress::float8 AS progress, completed_at
    FROM quests WHERE user_id = ${userId} AND week_start = ${ws} ORDER BY slug`
  ) as unknown as { slug: string; title: string; target: number; progress: number; completed_at: string | null }[];
  return rows.map((r) => ({
    slug: r.slug, title: r.title, target: r.target,
    progress: r.progress, completed: !!r.completed_at,
  }));
}

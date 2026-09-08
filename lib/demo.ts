import { sql, ensureUser } from './db';
import { DEMO_USER_ID } from './auth';
import { localDateStr, addDays, monthOf, weekStart } from './dates';
import { levelFromXp, XP_PER_ENTRY, XP_FIRST_ENTRY_OF_DAY } from './gamification';

// ── Shared demo account ─────────────────────────────────────────────────────
// One account every visitor lands in. Because it's shared, it accumulates junk,
// so /api/cron/reset-demo wipes and reseeds it nightly (see vercel.json).
// Seeding is deterministic-ish: realistic MYR amounts, ~60 days of history,
// enough XP and streak that the gamification UI is populated on first look.

const DAYS_OF_HISTORY = 60;

/** Plausible amounts per category, in MYR. */
const PATTERNS: { category: string; subtype?: string; amounts: number[]; perWeek: number; note?: string[] }[] = [
  { category: 'transport', amounts: [4.20, 5.60, 3.80, 12.40, 4.20, 5.60], perWeek: 5,
    note: ['Grab to office', 'LRT top-up', 'Grab home', ''] },
  { category: 'food', subtype: 'delivery', amounts: [23.90, 18.45, 31.20, 26.75, 19.90, 34.10], perWeek: 3,
    note: ['GrabFood', 'Foodpanda', 'late dinner', ''] },
  { category: 'food', subtype: 'cooked', amounts: [12.00, 15.50, 9.80, 12.00], perWeek: 4,
    note: ['lunch at mamak', 'kopitiam', ''] },
  { category: 'groceries', amounts: [86.40, 124.30, 62.15, 98.70], perWeek: 1,
    note: ['Jaya Grocer', 'Tesco run', ''] },
];

const BILLS: { category: string; amount: number; day: number }[] = [
  { category: 'rent',     amount: 1200.00, day: 1  },
  { category: 'wifi',     amount: 129.00,  day: 5  },
  { category: 'electric', amount: 87.50,   day: 12 },
  { category: 'water',    amount: 24.30,   day: 12 },
];

/** Deterministic PRNG so the demo looks the same shape every reseed. */
function makeRng(seed: number) {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17;
    x ^= x << 5;  x >>>= 0;
    return x / 4294967296;
  };
}

function pick<T>(arr: T[], r: number): T { return arr[Math.floor(r * arr.length) % arr.length]; }

/** Nudge an amount by a few percent so repeated buys aren't identical. */
function jitter(base: number, r: number, spread: number): number {
  const v = base * (1 + (r - 0.5) * 2 * spread);
  return Math.round(v * 100) / 100;
}

/** Wipes and rebuilds the demo account's data. */
export async function seedDemo(): Promise<void> {
  await ensureUser(DEMO_USER_ID, true);

  await sql`DELETE FROM expenses      WHERE user_id = ${DEMO_USER_ID}`;
  await sql`DELETE FROM no_spend_days WHERE user_id = ${DEMO_USER_ID}`;
  await sql`DELETE FROM badges        WHERE user_id = ${DEMO_USER_ID}`;
  await sql`DELETE FROM quests        WHERE user_id = ${DEMO_USER_ID}`;
  await sql`DELETE FROM xp_events     WHERE user_id = ${DEMO_USER_ID}`;
  await sql`DELETE FROM recurring     WHERE user_id = ${DEMO_USER_ID}`;

  const today = localDateStr();
  const rng = makeRng(20260908);
  const rows: { date: string; category: string; subtype: string | null; amount: number; note: string | null }[] = [];

  const skipDays = new Set([9, 17, 28]); // reserved for no-spend days

  for (let back = DAYS_OF_HISTORY; back >= 0; back--) {
    if (skipDays.has(back)) continue;
    const date = addDays(today, -back);
    const dom = Number(date.slice(8, 10));

    for (const p of PATTERNS) {
      // Convert "times per week" into a per-day probability.
      const chance = p.perWeek / 7;
      for (let k = 0; k < 2; k++) {
        if (rng() < chance / (k + 1)) {
          rows.push({
            date,
            category: p.category,
            subtype: p.subtype ?? null,
            // Delivery drifts most (fees/promos); staples drift a little.
            amount: jitter(pick(p.amounts, rng()), rng(),
                           p.subtype === 'delivery' ? 0.18 : 0.06),
            note: p.note ? (pick(p.note, rng()) || null) : null,
          });
        }
      }
    }
    for (const b of BILLS) {
      if (dom === b.day) {
        rows.push({ date, category: b.category, subtype: null, amount: b.amount, note: null });
      }
    }
  }

  // Bulk insert, chunked to stay well inside statement limits.
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    await sql`
      INSERT INTO expenses (user_id, date, category, subtype, amount, note)
      SELECT ${DEMO_USER_ID}, d.date::date, d.category, d.subtype, d.amount::numeric, d.note
      FROM jsonb_to_recordset(${JSON.stringify(chunk)}::jsonb)
        AS d(date text, category text, subtype text, amount text, note text)`;
  }

  // A couple of no-spend days for texture.
  for (const back of [9, 17, 28]) {
    await sql`INSERT INTO no_spend_days (user_id, date) VALUES (${DEMO_USER_ID}, ${addDays(today, -back)})
              ON CONFLICT DO NOTHING`;
  }

  // Recurring templates, pre-filled with last month's amount.
  for (const b of BILLS) {
    await sql`INSERT INTO recurring (user_id, category, last_amount, last_logged)
              VALUES (${DEMO_USER_ID}, ${b.category}, ${b.amount}, ${today})`;
  }

  // XP consistent with the seeded history, so the level bar looks earned.
  const totalXp = rows.length * XP_PER_ENTRY + DAYS_OF_HISTORY * XP_FIRST_ENTRY_OF_DAY;
  const streak = 12;
  await sql`
    INSERT INTO gamification (user_id, total_xp, current_streak, longest_streak,
                              last_active_date, freezes_used_month)
    VALUES (${DEMO_USER_ID}, ${totalXp}, ${streak}, 23, ${today}, NULL)
    ON CONFLICT (user_id) DO UPDATE SET
      total_xp = EXCLUDED.total_xp,
      current_streak = EXCLUDED.current_streak,
      longest_streak = EXCLUDED.longest_streak,
      last_active_date = EXCLUDED.last_active_date,
      freezes_used_month = NULL`;

  for (const slug of ['first_entry', 'streak_7', 'entries_100', 'no_spend_first']) {
    await sql`INSERT INTO badges (user_id, slug) VALUES (${DEMO_USER_ID}, ${slug})
              ON CONFLICT DO NOTHING`;
  }

  await sql`
    UPDATE settings SET monthly_budget = 2400, currency = 'MYR'
    WHERE user_id = ${DEMO_USER_ID}`;
}

/** Seeds only if the demo account looks empty, so normal logins stay fast. */
export async function ensureDemoSeeded(): Promise<void> {
  await ensureUser(DEMO_USER_ID, true);
  const [row] = (await sql`
    SELECT COUNT(*)::int AS n FROM expenses WHERE user_id = ${DEMO_USER_ID}`) as unknown as { n: number }[];
  if (row.n === 0) await seedDemo();
}

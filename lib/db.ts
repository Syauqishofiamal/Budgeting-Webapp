import { neon } from '@neondatabase/serverless';
import { Pool, types as pgTypes } from 'pg';

// Postgres DATE (OID 1082) must stay a plain 'YYYY-MM-DD' string. By default
// node-postgres parses it into a JS Date at LOCAL midnight, which in UTC+8
// reads back as the previous day in UTC — silently shifting every streak date
// back by one. Returning the raw string keeps dates timezone-free end to end.
pgTypes.setTypeParser(pgTypes.builtins.DATE, (v) => v);

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.');
}

const url = process.env.DATABASE_URL;

/**
 * Neon's driver speaks HTTP and only works against a Neon host. For local
 * Postgres (development) we fall back to node-postgres behind the same
 * tagged-template interface, so every query in the app is written once.
 */
type SqlFn = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;

function makeLocalSql(): SqlFn {
  const pool = new Pool({ connectionString: url, max: 5 });
  return async (strings: TemplateStringsArray, ...values: unknown[]) => {
    // Rebuild the statement with $1..$n placeholders.
    const text = strings.reduce(
      (acc, part, i) => acc + part + (i < values.length ? `$${i + 1}` : ''), '');
    const res = await pool.query(text, values as unknown[]);
    return res.rows;
  };
}

const isNeon = /neon\.tech|neon\.build/.test(url);

export const sql: SqlFn = isNeon
  ? (neon(url) as unknown as SqlFn)
  : makeLocalSql();

// ── Row types ───────────────────────────────────────────────────────────────
export interface ExpenseRow {
  id: number;
  date: string;
  category: string;
  custom_label: string | null;
  subtype: string | null;
  amount: string;   // NUMERIC arrives as string; parse at the edge.
  note: string | null;
  created_at: string;
}

export interface GamificationRow {
  user_id: string;
  total_xp: number;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
  freezes_used_month: string | null;
}

export interface SettingsRow {
  user_id: string;
  monthly_budget: string;
  currency: string;
  locale: string;
  sound_enabled: boolean;
  haptics_enabled: boolean;
}

/** Postgres DATE comes back as a Date or string depending on driver path. */
export function toDateStr(v: unknown): string {
  if (!v) return '';
  if (typeof v === 'string') return v.slice(0, 10);
  if (v instanceof Date) {
    // Drivers hand back DATE as local midnight; local getters recover the
    // intended calendar day. UTC getters would shift it west of Greenwich.
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(v).slice(0, 10);
}

/** Create user + default rows if absent. Idempotent. */
export async function ensureUser(userId: string, isDemo = false): Promise<void> {
  await sql`
    INSERT INTO users (id, is_demo) VALUES (${userId}, ${isDemo})
    ON CONFLICT (id) DO NOTHING`;
  await sql`
    INSERT INTO settings (user_id, monthly_budget, currency, locale)
    VALUES (${userId},
            ${process.env.DEFAULT_MONTHLY_BUDGET ?? '2000'},
            ${process.env.DEFAULT_CURRENCY ?? 'MYR'},
            ${process.env.DEFAULT_LOCALE ?? 'Asia/Kuala_Lumpur'})
    ON CONFLICT (user_id) DO NOTHING`;
  await sql`
    INSERT INTO gamification (user_id) VALUES (${userId})
    ON CONFLICT (user_id) DO NOTHING`;
}

export async function getSettings(userId: string): Promise<SettingsRow> {
  const rows = (await sql`
    SELECT * FROM settings WHERE user_id = ${userId}`) as unknown as SettingsRow[];
  return rows[0];
}

export async function getGamification(userId: string): Promise<GamificationRow> {
  const rows = (await sql`
    SELECT * FROM gamification WHERE user_id = ${userId}`) as unknown as GamificationRow[];
  const r = rows[0];
  return { ...r, last_active_date: r.last_active_date ? toDateStr(r.last_active_date) : null };
}

export async function getBadges(userId: string): Promise<string[]> {
  const rows = (await sql`
    SELECT slug FROM badges WHERE user_id = ${userId}`) as unknown as { slug: string }[];
  return rows.map((r) => r.slug);
}

/**
 * Up to `limit` most recent DISTINCT amounts for a category/subtype, newest
 * first. Powers the amount chips. DISTINCT ON keeps one row per amount while
 * preserving recency order.
 */
export async function recentAmounts(
  userId: string, category: string, subtype: string | null, limit: number,
): Promise<number[]> {
  const rows = (await sql`
    SELECT amount FROM (
      SELECT DISTINCT ON (amount) amount, created_at
      FROM expenses
      WHERE user_id = ${userId}
        AND category = ${category}
        AND subtype IS NOT DISTINCT FROM ${subtype}
      ORDER BY amount, created_at DESC
    ) t
    ORDER BY created_at DESC
    LIMIT ${limit}`) as unknown as { amount: string }[];
  return rows.map((r) => Number(r.amount));
}

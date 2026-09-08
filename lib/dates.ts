// ── Date helpers ────────────────────────────────────────────────────────────
// Streaks are DATE-based, not timestamp-based, and must roll over at midnight
// in the USER's timezone (Asia/Kuala_Lumpur), not the server's UTC. Vercel runs
// UTC, so naive `new Date()` would flip days at 8am local. Everything below
// formats through Intl with an explicit tz to avoid that.

export const DEFAULT_TZ = process.env.DEFAULT_LOCALE || 'Asia/Kuala_Lumpur';

/** 'YYYY-MM-DD' for `instant` as seen in `tz`. */
export function localDateStr(instant: Date = new Date(), tz: string = DEFAULT_TZ): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  return fmt.format(instant); // en-CA yields YYYY-MM-DD
}

export function addDays(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function monthOf(dateStr: string): string {
  return dateStr.slice(0, 7);
}

/** Monday-based week start for quest windows. */
export function weekStart(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  return addDays(dateStr, -dow);
}

export function monthBounds(month: string): { start: string; end: string } {
  const [y, m] = month.split('-').map(Number);
  const start = `${month}-01`;
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { start, end };
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function formatMoney(amount: number, currency = 'MYR'): string {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency', currency, minimumFractionDigits: 2,
  }).format(amount);
}

export function friendlyDate(dateStr: string, today: string): string {
  if (dateStr === today) return 'Today';
  if (dateStr === addDays(today, -1)) return 'Yesterday';
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', timeZone: 'UTC',
  });
}

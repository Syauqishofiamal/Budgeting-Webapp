// ── Feedback copy ───────────────────────────────────────────────────────────
// Tone: warm, brief, a little playful. Never guilt, never nagging, never red
// alarm. The user is rewarded for HONESTY, so copy praises the logging act and
// stays neutral about the amount — a big number gets the same warmth as a small
// one. Rotation avoids immediate repeats so it doesn't feel robotic by day 3.

export const SAVE_MESSAGES: string[] = [
  'Logged. Nice and quick.',
  'Tracked before you forgot.',
  '+{xp} XP. Your future self says thanks.',
  'Got it. That one’s on the record.',
  'Noted. Back to your day.',
  'Filed away. Easy.',
  'Done — that took about two seconds.',
  'In the books.',
  'Another one tracked.',
  'Captured. No thinking required.',
  'Logged it. Momentum is a real thing.',
  'Saved. You’re building a nice picture here.',
  'That’s the habit working.',
  'Recorded. Nothing slips through.',
  'Neat. Straight into the ledger.',
  'Locked in.',
  'Tracked. Honest numbers beat pretty ones.',
  'Down on paper. Well, pixels.',
  'Counted. Every entry sharpens the picture.',
  'Logged — that’s the whole trick, really.',
  'Saved. Small act, compounding payoff.',
  'Noted without judgement.',
];

export const STREAK_MESSAGES: string[] = [
  'Logged. That’s {streak} days running.',
  '{streak} days straight. Quietly impressive.',
  'Day {streak} of the streak. Still going.',
  '{streak} in a row — that’s a habit now.',
];

export const NO_SPEND_MESSAGES: string[] = [
  'A no-spend day. Those count double for clarity.',
  'Zero out. Logged all the same.',
  'Nothing spent, still tracked. That’s the discipline.',
  'Quiet day on the books.',
];

export const LEVEL_UP_MESSAGES: string[] = [
  'Level {level}. The bar resets, the habit doesn’t.',
  'Level {level} unlocked.',
  'Up to level {level}. Nicely done.',
];

export const FREEZE_MESSAGES: string[] = [
  'Used your monthly streak freeze — the run survives.',
  'One day missed, freeze applied. Streak intact.',
];

/** Interpolates {xp}, {streak}, {level} placeholders. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

/**
 * Pick a message avoiding the immediately-previous one. `lastIndex` is held in
 * client state so the same line never appears twice in a row.
 */
export function rotate(pool: string[], lastIndex: number): { text: string; index: number } {
  if (pool.length === 1) return { text: pool[0], index: 0 };
  let i = Math.floor(Math.random() * pool.length);
  if (i === lastIndex) i = (i + 1) % pool.length;
  return { text: pool[i], index: i };
}

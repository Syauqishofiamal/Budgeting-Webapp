// ── Gamification math ───────────────────────────────────────────────────────
// Every number here is a tuning knob. Change them freely; nothing else in the
// codebase hardcodes these values.
//
// DESIGN RULE: XP is awarded for the ACT OF LOGGING, never for spending little.
// If overspending cost XP, the incentive would be to hide bad purchases — which
// destroys the data the whole app depends on. Honesty must always pay.

// ── XP awards ───────────────────────────────────────────────────────────────
export const XP_PER_ENTRY = 10;
/** Bonus the first time you log on a given day (the "showed up" reward). */
export const XP_FIRST_ENTRY_OF_DAY = 25;
/** "No spending today" is a real, deliberate act of tracking. Same reward. */
export const XP_NO_SPEND_DAY = 25;
export const XP_QUEST_COMPLETE = 50;
export const XP_BADGE_UNLOCK = 40;

// ── Level curve ─────────────────────────────────────────────────────────────
// Quadratic: total XP to *reach* level L is BASE * (L-1)^2 + STEP * (L-1).
// Level 2 @ 60 XP, 3 @ 160, 4 @ 300, 5 @ 480, 10 @ 1860.
// Early levels land in the first few days; later ones stretch to weeks.
export const LEVEL_BASE = 20;
export const LEVEL_STEP = 40;

export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  const n = level - 1;
  return LEVEL_BASE * n * n + LEVEL_STEP * n;
}

export function levelFromXp(totalXp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= totalXp) level++;
  return level;
}

export interface LevelProgress {
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  progress: number; // 0..1, for the animated bar
}

export function levelProgress(totalXp: number): LevelProgress {
  const level = levelFromXp(totalXp);
  const floor = xpForLevel(level);
  const ceil = xpForLevel(level + 1);
  const span = ceil - floor;
  const into = totalXp - floor;
  return {
    level,
    xpIntoLevel: into,
    xpForNextLevel: span,
    progress: span > 0 ? into / span : 0,
  };
}

// ── Streaks ─────────────────────────────────────────────────────────────────
// A streak day = you logged an expense OR tapped "No spending today".
// Undo must NOT count as activity (see rollback logic in lib/db.ts).
//
// FREEZE: exactly one per calendar month, auto-applied to a single missed day.
// A 40-day streak shouldn't die because you fell asleep early once.
export const STREAK_FREEZES_PER_MONTH = 1;
/** Every Nth day of streak triggers the bigger celebration. */
export const STREAK_CELEBRATION_INTERVAL = 7;

export interface StreakState {
  current: number;
  longest: number;
  lastActiveDate: string | null;  // 'YYYY-MM-DD' in user's local tz
  freezesUsedMonth: string | null; // 'YYYY-MM' the freeze was last spent
  freezeUsedInMonth: boolean;
}

/** Whole days between two 'YYYY-MM-DD' strings. Date-only, tz-free. */
export function daysBetween(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

export interface StreakResult {
  state: StreakState;
  incremented: boolean;
  freezeApplied: boolean;
}

/**
 * Advance the streak for activity on `today`.
 *
 * gap === 0  → already active today, no change (idempotent).
 * gap === 1  → consecutive day, increment.
 * gap === 2  → exactly one day missed; spend the monthly freeze if unused,
 *              which bridges the gap and keeps the run alive. Else reset to 1.
 * gap > 2    → too much to bridge, restart at 1. No punishment, no XP loss.
 */
export function advanceStreak(prev: StreakState, today: string): StreakResult {
  const month = today.slice(0, 7);
  // Freeze allowance resets when the calendar month rolls over.
  const freezeUsedThisMonth = prev.freezesUsedMonth === month;

  if (!prev.lastActiveDate) {
    return {
      state: { ...prev, current: 1, longest: Math.max(prev.longest, 1),
               lastActiveDate: today, freezeUsedInMonth: freezeUsedThisMonth },
      incremented: true, freezeApplied: false,
    };
  }

  const gap = daysBetween(prev.lastActiveDate, today);

  if (gap <= 0) {
    return { state: { ...prev, freezeUsedInMonth: freezeUsedThisMonth },
             incremented: false, freezeApplied: false };
  }

  if (gap === 1) {
    const current = prev.current + 1;
    return {
      state: { ...prev, current, longest: Math.max(prev.longest, current),
               lastActiveDate: today, freezeUsedInMonth: freezeUsedThisMonth },
      incremented: true, freezeApplied: false,
    };
  }

  if (gap === 2 && !freezeUsedThisMonth) {
    // Bridge the single missed day: +1 for the frozen day, +1 for today.
    const current = prev.current + 2;
    return {
      state: { ...prev, current, longest: Math.max(prev.longest, current),
               lastActiveDate: today, freezesUsedMonth: month, freezeUsedInMonth: true },
      incremented: true, freezeApplied: true,
    };
  }

  return {
    state: { ...prev, current: 1, longest: Math.max(prev.longest, 1),
             lastActiveDate: today, freezeUsedInMonth: freezeUsedThisMonth },
    incremented: true, freezeApplied: false,
  };
}

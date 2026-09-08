// ── Badges ──────────────────────────────────────────────────────────────────
// Milestones only. Nothing here can be lost once earned.

export interface BadgeDef {
  slug: string;
  label: string;
  icon: string;
  hint: string;
}

export const BADGES: BadgeDef[] = [
  { slug: 'first_entry',     label: 'First Step',      icon: '🌱', hint: 'Log your first expense' },
  { slug: 'streak_7',        label: 'Week Strong',     icon: '🔥', hint: 'A 7-day streak' },
  { slug: 'streak_30',       label: 'Unbroken',        icon: '💎', hint: 'A 30-day streak' },
  { slug: 'entries_100',     label: 'Centurion',       icon: '💯', hint: 'Log 100 entries' },
  { slug: 'month_complete',  label: 'Full Picture',    icon: '📖', hint: 'Log every day of a month' },
  { slug: 'month_under',     label: 'Under Budget',    icon: '🎯', hint: 'Finish a month under budget' },
  { slug: 'no_spend_first',  label: 'Zero Day',        icon: '🧘', hint: 'Log your first no-spend day' },
  { slug: 'quest_first',     label: 'Questing',        icon: '🗺️', hint: 'Complete your first quest' },
];

export const BADGE_MAP: Record<string, BadgeDef> =
  Object.fromEntries(BADGES.map((b) => [b.slug, b]));

export interface BadgeContext {
  totalEntries: number;
  currentStreak: number;
  noSpendDays: number;
  questsCompleted: number;
  monthFullyLogged: boolean;
  monthUnderBudget: boolean;
}

/** Returns badge slugs newly earned given context. Caller filters already-owned. */
export function evaluateBadges(ctx: BadgeContext): string[] {
  const earned: string[] = [];
  if (ctx.totalEntries >= 1) earned.push('first_entry');
  if (ctx.totalEntries >= 100) earned.push('entries_100');
  if (ctx.currentStreak >= 7) earned.push('streak_7');
  if (ctx.currentStreak >= 30) earned.push('streak_30');
  if (ctx.noSpendDays >= 1) earned.push('no_spend_first');
  if (ctx.questsCompleted >= 1) earned.push('quest_first');
  if (ctx.monthFullyLogged) earned.push('month_complete');
  if (ctx.monthUnderBudget) earned.push('month_under');
  return earned;
}

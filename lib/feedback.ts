'use client';
import { SAVE_MESSAGES, STREAK_MESSAGES, NO_SPEND_MESSAGES, LEVEL_UP_MESSAGES,
         FREEZE_MESSAGES, fill, rotate } from './copy';
import { STREAK_CELEBRATION_INTERVAL } from './gamification';
import type { LogResponse } from './types';

// Rotation cursors persist for the page session so lines don't repeat back-to-back.
const cursors: Record<string, number> = { save: -1, streak: -1, nospend: -1, level: -1, freeze: -1 };

export interface Feedback {
  line: string;
  sub: string;
  celebrate: null | { icon: string; title: string; body: string };
}

export function buildFeedback(res: LogResponse, kind: 'expense' | 'no_spend'): Feedback {
  let line: string;
  if (kind === 'no_spend') {
    const p = rotate(NO_SPEND_MESSAGES, cursors.nospend);
    cursors.nospend = p.index;
    line = p.text;
  } else if (res.streakIncremented && res.streak > 1 && Math.random() < 0.4) {
    // Sometimes lead with the streak; keeps the copy from feeling formulaic.
    const p = rotate(STREAK_MESSAGES, cursors.streak);
    cursors.streak = p.index;
    line = fill(p.text, { streak: res.streak });
  } else {
    const p = rotate(SAVE_MESSAGES, cursors.save);
    cursors.save = p.index;
    line = fill(p.text, { xp: res.xpGained });
  }

  const bits = [`+${res.xpGained} XP`];
  if (res.streak > 0) bits.push(`${res.streak}-day streak`);
  if (res.freezeApplied) {
    const p = rotate(FREEZE_MESSAGES, cursors.freeze);
    cursors.freeze = p.index;
    bits.push('freeze used');
  }

  let celebrate: Feedback['celebrate'] = null;
  if (res.leveledUp) {
    const p = rotate(LEVEL_UP_MESSAGES, cursors.level);
    cursors.level = p.index;
    celebrate = {
      icon: '⭐️', title: `Level ${res.levelAfter}`,
      body: fill(p.text, { level: res.levelAfter }),
    };
  } else if (res.newBadges.length > 0) {
    celebrate = { icon: '🏅', title: 'Badge unlocked', body: '' };
  } else if (res.streakIncremented && res.streak > 0
             && res.streak % STREAK_CELEBRATION_INTERVAL === 0) {
    celebrate = {
      icon: '🔥', title: `${res.streak} days`,
      body: 'That is a genuine habit now.',
    };
  }

  return { line, sub: bits.join(' · '), celebrate };
}

/** Optional, off by default, and silently ignored where unsupported. */
export function buzz(enabled: boolean, pattern: number | number[] = 12): void {
  if (!enabled) return;
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try { navigator.vibrate(pattern); } catch { /* no-op */ }
  }
}

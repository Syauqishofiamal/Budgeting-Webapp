export interface Expense {
  id: number;
  date: string;
  category: string;
  custom_label: string | null;
  subtype: string | null;
  amount: number;
  note: string | null;
  created_at: string;
  /** Client-only: true while the server write is still in flight. */
  pending?: boolean;
}

export interface QuestView {
  slug: string; title: string; target: number; progress: number; completed: boolean;
}

export interface AppState {
  today: string;
  isDemo: boolean;
  settings: {
    monthlyBudget: number; currency: string; locale: string;
    soundEnabled: boolean; hapticsEnabled: boolean;
  };
  budget: { total: number; spent: number; remaining: number; fraction: number; over: boolean };
  xp: { total: number; level: number; xpIntoLevel: number; xpForNextLevel: number; progress: number };
  streak: { current: number; longest: number; lastActive: string | null; freezeAvailable: boolean };
  badges: string[];
  quests: QuestView[];
  todayTotal: number;
  noSpendToday: boolean;
  todayExpenses: Expense[];
  byCategory: { category: string; subtype: string | null; total: number; n: number }[];
  recurring: { id: number; category: string; custom_label: string | null;
               last_amount: number; last_logged: string | null }[];
}

export interface LogResponse {
  expenseId: number | null;
  xpGained: number; totalXp: number;
  levelBefore: number; levelAfter: number; leveledUp: boolean;
  streak: number; streakIncremented: boolean; freezeApplied: boolean;
  newBadges: string[];
}

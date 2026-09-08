-- ── Coffer schema ──────────────────────────────────────────────────────────
-- Run against Neon/Supabase Postgres. Safe to re-run (idempotent).

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  is_demo       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  user_id         TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  monthly_budget  NUMERIC(12,2) NOT NULL DEFAULT 2000,
  currency        TEXT NOT NULL DEFAULT 'MYR',
  locale          TEXT NOT NULL DEFAULT 'Asia/Kuala_Lumpur',
  sound_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
  haptics_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
  id           BIGSERIAL PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  category     TEXT NOT NULL,
  custom_label TEXT,
  subtype      TEXT,
  amount       NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_user_date
  ON expenses (user_id, date DESC);
-- Powers the "recent distinct amounts" chip lookup.
CREATE INDEX IF NOT EXISTS idx_expenses_user_cat_created
  ON expenses (user_id, category, subtype, created_at DESC);

-- Days explicitly marked "no spending". Kept separate from expenses so a zero
-- row never pollutes spending totals or category breakdowns.
CREATE TABLE IF NOT EXISTS no_spend_days (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS gamification (
  user_id            TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_xp           INTEGER NOT NULL DEFAULT 0,
  current_streak     INTEGER NOT NULL DEFAULT 0,
  longest_streak     INTEGER NOT NULL DEFAULT 0,
  last_active_date   DATE,
  freezes_used_month TEXT,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS badges (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug        TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, slug)
);

-- Recurring bill templates: one-tap logging with last month's amount pre-filled.
CREATE TABLE IF NOT EXISTS recurring (
  id            BIGSERIAL PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category      TEXT NOT NULL,
  custom_label  TEXT,
  last_amount   NUMERIC(12,2) NOT NULL,
  last_logged   DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_recurring_user ON recurring (user_id);

CREATE TABLE IF NOT EXISTS quests (
  id           BIGSERIAL PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start   DATE NOT NULL,
  slug         TEXT NOT NULL,
  title        TEXT NOT NULL,
  target       NUMERIC(12,2) NOT NULL,
  progress     NUMERIC(12,2) NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  UNIQUE (user_id, week_start, slug)
);
CREATE INDEX IF NOT EXISTS idx_quests_user_week ON quests (user_id, week_start);

-- Audit trail so Undo can roll back XP/streak/badges exactly.
CREATE TABLE IF NOT EXISTS xp_events (
  id          BIGSERIAL PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expense_id  BIGINT,
  kind        TEXT NOT NULL,
  xp_delta    INTEGER NOT NULL,
  -- Full pre-change snapshot, so Undo restores rather than recomputes.
  snapshot    JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_xp_events_expense ON xp_events (expense_id);

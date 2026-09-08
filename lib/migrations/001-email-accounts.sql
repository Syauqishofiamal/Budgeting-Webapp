-- ── Migration: email + password accounts ────────────────────────────────────
-- Adds real multi-user accounts to a schema that previously had one hardcoded
-- owner. Safe to re-run. Existing rows are preserved: the legacy 'owner' user
-- keeps its id, so every expense, badge and streak stays attached to it.

-- Accounts carry an email and a bcrypt hash. Both are nullable so the existing
-- 'owner' and 'demo' rows stay valid until the owner claims an email.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email         TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name  TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at     TIMESTAMPTZ;

-- Emails are compared case-insensitively; store them already lowercased and
-- enforce uniqueness so two accounts can never claim the same address.
-- Partial index: demo/legacy rows with NULL email are exempt.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
  ON users (email) WHERE email IS NOT NULL;

-- Single-use tokens for email verification and password reset. Storing only a
-- SHA-256 hash means a leaked database still cannot be used to reset accounts.
CREATE TABLE IF NOT EXISTS auth_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose    TEXT NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens (user_id, purpose);

-- Throttles login and signup attempts per email/IP without extra infrastructure.
CREATE TABLE IF NOT EXISTS auth_attempts (
  id         BIGSERIAL PRIMARY KEY,
  identifier TEXT NOT NULL,
  kind       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auth_attempts_lookup
  ON auth_attempts (identifier, kind, created_at DESC);

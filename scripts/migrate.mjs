#!/usr/bin/env node
/**
 * Applies lib/migrations/*.sql in filename order, skipping any already run.
 *
 *   node scripts/migrate.mjs
 *
 * Each migration is idempotent on its own, but the ledger means a re-run is
 * a no-op rather than a gamble.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

for (const f of ['.env.local', '.env']) {
  try {
    for (const line of readFileSync(join(root, f), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
      }
    }
  } catch { /* absent is fine */ }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: true },
});

try {
  await client.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

  const { rows } = await client.query('SELECT name FROM schema_migrations');
  const done = new Set(rows.map((r) => r.name));

  const dir = join(root, 'lib', 'migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  let applied = 0;
  for (const f of files) {
    if (done.has(f)) { console.log('skip   ', f); continue; }
    const sql = readFileSync(join(dir, f), 'utf8');
    // Each migration runs in its own transaction: a failure rolls back cleanly
    // instead of leaving the schema half-changed.
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [f]);
      await client.query('COMMIT');
      console.log('applied', f);
      applied++;
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`${f} failed: ${err.message}`);
    }
  }
  console.log(applied ? `\n${applied} migration(s) applied.` : '\nAlready up to date.');
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}

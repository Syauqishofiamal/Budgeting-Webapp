#!/usr/bin/env node
/**
 * Applies lib/schema.sql to the database in DATABASE_URL.
 * Safe to re-run: every statement is CREATE ... IF NOT EXISTS.
 *
 *   node scripts/setup-db.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));

// Load .env.local / .env without a dependency.
for (const f of ['.env.local', '.env']) {
  try {
    for (const line of readFileSync(join(here, '..', f), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
      }
    }
  } catch { /* file absent, fine */ }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env.local first.');
  process.exit(1);
}

const sql = readFileSync(join(here, '..', 'lib', 'schema.sql'), 'utf8');
const client = new pg.Client({
  connectionString: url,
  // Verify the server certificate for remote databases. Neon and Supabase both
  // present valid CA-signed certs, so there is no reason to disable this —
  // rejectUnauthorized:false would leave the connection open to interception.
  ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: true },
});

try {
  await client.connect();
  await client.query(sql);
  const { rows } = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' ORDER BY table_name`);
  console.log('Schema applied. Tables:');
  for (const r of rows) console.log('  -', r.table_name);
} catch (err) {
  console.error('Setup failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}

#!/usr/bin/env node
// Usage: node scripts/hash-password.mjs "your-password"
import bcrypt from 'bcryptjs';

const pw = process.argv[2];
if (!pw) {
  console.error('Usage: node scripts/hash-password.mjs "your-password"');
  process.exit(1);
}
if (pw.length < 8) {
  console.error('Use at least 8 characters.');
  process.exit(1);
}
console.log(await bcrypt.hash(pw, 12));

#!/usr/bin/env tsx
/**
 * Sync .env.production to Vercel (production environment).
 *
 * Safety checks before anything is uploaded:
 *  - every key in .env.production must have a real (non-placeholder) value
 *  - secret keys must DIFFER from your dev values in .env/.env.local
 *  - Stripe keys must be live keys (sk_live_/pk_live_), never test keys
 *  - URLs must be https and must not point at localhost
 *
 * Usage:
 *   pnpm env:sync:prod            # validate + sync
 *   pnpm env:sync:prod --dry-run  # validate + show what would be synced
 *
 * Requires a linked Vercel project (`vercel link`). Uses the `vercel` CLI from
 * PATH, or falls back to `pnpm dlx vercel`.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

// Secrets that must never be reused between dev and production.
const MUST_DIFFER_FROM_DEV = [
  'DATABASE_URL',
  'BETTER_AUTH_SECRET',
  'STRIPE_SECRET_KEY',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'CRON_SECRET',
];

// key -> required value prefix in production
const REQUIRED_PREFIXES: Record<string, string[]> = {
  STRIPE_SECRET_KEY: ['sk_live_'],
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: ['pk_live_'],
  STRIPE_WEBHOOK_SECRET: ['whsec_'],
  DATABASE_URL: ['postgres://', 'postgresql://'],
};

const URL_KEYS = ['BETTER_AUTH_URL', 'NEXT_PUBLIC_APP_URL'];

const PLACEHOLDER_PATTERN = /your[-_]|example\.com|xxx|changeme|<|>/i;

function parseEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const vars: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[match[1]] = value;
  }
  return vars;
}

function fail(errors: string[]): never {
  console.error('\n❌ Validation failed — nothing was synced:\n');
  for (const e of errors) console.error(`   • ${e}`);
  console.error('');
  process.exit(1);
}

// --- load files ---------------------------------------------------------------

const prodPath = resolve(ROOT, '.env.production');
if (!existsSync(prodPath)) {
  fail(['.env.production not found — create it in the repo root and fill in production values.']);
}
const prod = parseEnvFile(prodPath);
// .env.local overrides .env, matching Next.js resolution order
const dev = { ...parseEnvFile(resolve(ROOT, '.env')), ...parseEnvFile(resolve(ROOT, '.env.local')) };

// --- validate -----------------------------------------------------------------

const errors: string[] = [];
const warnings: string[] = [];

const keys = Object.keys(prod);
if (keys.length === 0) errors.push('.env.production contains no variables.');

for (const [key, value] of Object.entries(prod)) {
  if (!value) {
    errors.push(`${key} is empty — fill in the production value.`);
    continue;
  }
  if (PLACEHOLDER_PATTERN.test(value)) {
    errors.push(`${key} looks like a placeholder: "${value.slice(0, 40)}…"`);
    continue;
  }
  if (MUST_DIFFER_FROM_DEV.includes(key) && dev[key] && dev[key] === value) {
    errors.push(`${key} is IDENTICAL to your dev value in .env/.env.local — use a production value.`);
  }
  const prefixes = REQUIRED_PREFIXES[key];
  if (prefixes && !prefixes.some((p) => value.startsWith(p))) {
    errors.push(`${key} must start with ${prefixes.join(' or ')} (got "${value.slice(0, 8)}…").`);
  }
  if (/^(sk|pk)_test_/.test(value)) {
    errors.push(`${key} is a Stripe TEST key — production needs a live key.`);
  }
  if (URL_KEYS.includes(key)) {
    if (/localhost|127\.0\.0\.1/.test(value)) errors.push(`${key} points at localhost: "${value}"`);
    else if (!value.startsWith('https://')) errors.push(`${key} must be an https:// URL (got "${value}").`);
  }
}

// keys present in dev but missing from .env.production (excluding local-only ones)
const LOCAL_ONLY = ['BETTER_AUTH_URL', 'NODE_ENV', 'LOG_LEVEL', 'YOUR_NEON_API_KEY'];
for (const key of Object.keys(dev)) {
  if (!(key in prod) && !LOCAL_ONLY.includes(key)) {
    warnings.push(`${key} exists in dev env but not in .env.production — intentional?`);
  }
}

if (warnings.length > 0) {
  console.warn('\n⚠️  Warnings:');
  for (const w of warnings) console.warn(`   • ${w}`);
}
if (errors.length > 0) fail(errors);

console.log(`\n✅ ${keys.length} variables validated (Stripe live keys, no dev value reuse, no localhost URLs).`);

// --- sync to Vercel -----------------------------------------------------------

const vercelCmd =
  spawnSync('vercel', ['--version'], { stdio: 'ignore' }).status === 0
    ? ['vercel']
    : ['pnpm', 'dlx', 'vercel'];

function runVercel(args: string[], input?: string) {
  const [cmd, ...prefix] = vercelCmd;
  return spawnSync(cmd, [...prefix, ...args], {
    cwd: ROOT,
    input,
    encoding: 'utf8',
  });
}

if (DRY_RUN) {
  console.log('\n🔎 Dry run — would sync to Vercel (production):');
  for (const key of keys) console.log(`   • ${key}`);
  console.log(`\nUsing CLI: ${vercelCmd.join(' ')}`);
  process.exit(0);
}

if (!existsSync(resolve(ROOT, '.vercel', 'project.json'))) {
  fail(['Project is not linked to Vercel — run `vercel link` first.']);
}

console.log(`\n🚀 Syncing ${keys.length} variables to Vercel (production)…\n`);

let failed = 0;
for (const key of keys) {
  // remove the existing production value first (ignore "not found" failures)
  runVercel(['env', 'rm', key, 'production', '--yes']);
  const result = runVercel(['env', 'add', key, 'production'], prod[key]);
  if (result.status === 0) {
    console.log(`   ✓ ${key}`);
  } else {
    failed++;
    const detail = (result.stderr || result.stdout || '').trim().split('\n').pop();
    console.error(`   ✗ ${key} — ${detail}`);
  }
}

if (failed > 0) {
  console.error(`\n❌ ${failed}/${keys.length} variables failed to sync.`);
  process.exit(1);
}
console.log(`\n✅ All ${keys.length} variables synced. Redeploy for changes to take effect.`);

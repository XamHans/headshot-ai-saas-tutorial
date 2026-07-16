import { type ChildProcess, execSync, spawn } from 'node:child_process';
import { existsSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Playwright global setup/teardown for real Stripe webhook delivery.
 *
 * The unlock flow depends on Stripe's `checkout.session.completed` webhook
 * reaching the e2e dev server. We spawn the already-authenticated Stripe CLI's
 * `stripe listen --forward-to localhost:${PORT}/api/payments/webhook` for the
 * duration of the run — this is normal, supported local/CI webhook testing, not
 * a mock. The signing secret from `stripe listen --print-secret` is written into
 * `process.env.STRIPE_WEBHOOK_SECRET` BEFORE the dev server boots so the route's
 * signature verification matches the events the CLI forwards.
 */

const PORT = process.env.PORT ? Number(process.env.PORT) : 3131;
const PID_FILE = join(process.cwd(), 'e2e', '.stripe-listen.pid');

function loadEnvFile(file: string) {
  const path = join(process.cwd(), file);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

export default async function globalSetup() {
  for (const file of ['.env', '.env.local']) loadEnvFile(file);

  // Pre-fetch the stable webhook signing secret and pin it for the whole run
  // (dev server + this test process) so the route can verify forwarded events.
  const secret = execSync('stripe listen --print-secret', { encoding: 'utf-8' }).trim();
  if (!secret.startsWith('whsec_')) {
    throw new Error(`Unexpected stripe listen --print-secret output: ${secret}`);
  }
  process.env.STRIPE_WEBHOOK_SECRET = secret;

  // Spawn the forwarder. Detached + unref'd so it survives this globalSetup
  // process exiting and keeps forwarding for the whole run; teardown signals
  // the process group. Its output goes to a log file for diagnostics.
  const logFile = join(process.cwd(), 'e2e', '.stripe-listen.log');
  const out = openSync(logFile, 'w');
  const child: ChildProcess = spawn(
    'stripe',
    ['listen', '--skip-verify', '--forward-to', `localhost:${PORT}/api/payments/webhook`],
    { stdio: ['ignore', out, out], detached: true },
  );

  if (!child.pid) {
    throw new Error('Failed to spawn `stripe listen`');
  }
  writeFileSync(PID_FILE, String(child.pid), 'utf-8');
  child.unref();

  // Wait until the CLI reports it is ready (its tunnel is established) before
  // letting tests run, so the very first webhook is actually forwarded.
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (existsSync(logFile) && readFileSync(logFile, 'utf-8').includes('Ready!')) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

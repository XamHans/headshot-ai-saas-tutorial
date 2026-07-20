/**
 * One-off: apply the hand-written migration files 0001–0005, which are not
 * registered in Drizzle's _journal.json (only 0000 is), so `db:migrate`
 * skips them. Statements are idempotent-guarded per file via IF NOT EXISTS
 * where the files provide it; each file runs inside a transaction.
 *
 * Usage: npx tsx lib/db/scripts/apply-manual-migrations.ts --env .env.production
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from 'dotenv';

const args = process.argv.slice(2);
const envFlag = args.indexOf('--env');
const envFile = envFlag !== -1 ? args[envFlag + 1] : '.env.local';

if (!existsSync(envFile)) {
  console.error(`Env file not found: ${envFile}`);
  process.exit(1);
}
config({ path: envFile });

const FILES = [
  '0001_add_payments_tables.sql',
  '0002_add_biometric_consent.sql',
  '0003_add_headshot_tables.sql',
  '0004_add_abuse_controls.sql',
  '0005_raise_free_generation_cap.sql',
];

async function main() {
  const { default: postgres } = await import('postgres');
  const sql = postgres(process.env.DATABASE_URL as string, { max: 1, prepare: false });
  const host = new URL(process.env.DATABASE_URL as string).host;
  console.log(`Applying manual migrations at ${host} (env: ${envFile})`);

  for (const file of FILES) {
    const content = readFileSync(join('lib/db/migrations', file), 'utf8');
    const statements = content
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);
    await sql.begin(async (tx) => {
      for (const statement of statements) {
        await tx.unsafe(statement);
      }
    });
    console.log(`  applied ${file}`);
  }
  await sql.end();
  console.log('Done.');
}

main().catch((error) => {
  console.error('Failed:', error);
  process.exit(1);
});

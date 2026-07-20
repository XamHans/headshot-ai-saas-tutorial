/**
 * Apply pending Drizzle migrations from lib/db/migrations.
 *
 * Usage:
 *   pnpm db:migrate                          # uses .env.local
 *   pnpm db:migrate -- --env .env.production # target another environment
 */
import { existsSync } from 'node:fs';
import { config } from 'dotenv';

const args = process.argv.slice(2);
const envFlag = args.indexOf('--env');
const envFile = envFlag !== -1 ? args[envFlag + 1] : '.env.local';

if (!existsSync(envFile)) {
  console.error(`Env file not found: ${envFile}`);
  process.exit(1);
}
config({ path: envFile });

if (!process.env.DATABASE_URL) {
  console.error(`DATABASE_URL is not set in ${envFile}`);
  process.exit(1);
}

async function main() {
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const { migrate } = await import('drizzle-orm/postgres-js/migrator');
  const { default: postgres } = await import('postgres');

  const host = new URL(process.env.DATABASE_URL as string).host;
  console.log(`Migrating database at ${host} (env: ${envFile})`);

  const client = postgres(process.env.DATABASE_URL as string, { max: 1, prepare: false });
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: 'lib/db/migrations' });
  await client.end();
  console.log('Migrations applied.');
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});

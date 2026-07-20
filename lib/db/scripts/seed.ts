/**
 * Seed the database with demo data (users, payments, headshot jobs + images).
 *
 * Usage:
 *   pnpm db:seed                          # uses .env.local
 *   pnpm db:seed -- --env .env.production # target another environment (e.g. Neon prod)
 *   pnpm db:seed -- --env .env.production --reset  # delete previously seeded rows first
 *
 * All seeded rows carry a `seed_` id prefix so they are identifiable and the
 * script stays idempotent: inserts use ON CONFLICT DO NOTHING, so re-running
 * never duplicates data.
 */
import { existsSync } from 'node:fs';
import { config } from 'dotenv';

const args = process.argv.slice(2);
const envFlag = args.indexOf('--env');
const envFile = envFlag !== -1 ? args[envFlag + 1] : '.env.local';
const reset = args.includes('--reset');

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
  // Import after dotenv so lib/db picks up DATABASE_URL at module load.
  const { sql: rawSql, like } = await import('drizzle-orm');
  const { db } = await import('@/lib/db');
  const { user } = await import('@/modules/users/schema');
  const { payments, webhookEvents } = await import('@/modules/payments/schema');
  const { headshotJobs, headshotImages } = await import('@/modules/headshot/schema');
  const { HEADSHOT_STYLES, HEADSHOT_VARIANT_COUNT } = await import('@/modules/headshot/styles');

  const database = db();
  const host = new URL(process.env.DATABASE_URL as string).host;
  console.log(`Seeding database at ${host} (env: ${envFile})`);

  const expectedTables = ['user', 'payments', 'webhook_events', 'headshot_jobs', 'headshot_images'];
  const existing = await database.execute(rawSql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `);
  const existingNames = new Set(existing.map((r: { table_name: string }) => r.table_name));
  const missing = expectedTables.filter((t) => !existingNames.has(t));
  if (missing.length > 0) {
    console.error(`Missing tables: ${missing.join(', ')}. Run migrations first (pnpm db:migrate).`);
    process.exit(1);
  }

  if (reset) {
    console.log('Resetting previously seeded rows...');
    await database.delete(headshotImages).where(like(headshotImages.id, 'seed_%'));
    await database.delete(headshotJobs).where(like(headshotJobs.id, 'seed_%'));
    await database.delete(webhookEvents).where(like(webhookEvents.id, 'seed_%'));
    await database.delete(payments).where(like(payments.id, 'seed_%'));
    await database.delete(user).where(like(user.id, 'seed_%'));
  }

  const now = new Date();
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // --- Users ------------------------------------------------------------
  const seedUsers = [
    {
      id: 'seed_user_alice',
      name: 'Alice Baumann',
      email: 'alice.baumann@example.com',
      emailVerified: true,
      biometricConsentAt: daysAgo(12),
      headshotFreeGenerationCount: 1,
      createdAt: daysAgo(30),
      updatedAt: daysAgo(2),
    },
    {
      id: 'seed_user_bruno',
      name: 'Bruno Keller',
      email: 'bruno.keller@example.com',
      emailVerified: true,
      biometricConsentAt: daysAgo(6),
      headshotFreeGenerationCount: 2,
      createdAt: daysAgo(14),
      updatedAt: daysAgo(1),
    },
    {
      id: 'seed_user_clara',
      name: 'Clara Winter',
      email: 'clara.winter@example.com',
      emailVerified: false,
      headshotFreeGenerationCount: 0,
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },
  ];
  await database.insert(user).values(seedUsers).onConflictDoNothing();

  // --- Payments + webhook audit trail -----------------------------------
  const seedPayments = [
    {
      id: 'seed_payment_alice_1',
      stripePaymentIntentId: 'pi_seed_alice_1',
      stripeCheckoutSessionId: 'cs_seed_alice_1',
      amount: '9.99',
      currency: 'EUR',
      description: 'Headshot unlock — full-resolution set',
      status: 'succeeded',
      userId: 'seed_user_alice',
      metadata: { jobId: 'seed_job_alice_done', product: 'headshot_unlock' },
      createdAt: daysAgo(10),
      updatedAt: daysAgo(10),
      paidAt: daysAgo(10),
    },
    {
      id: 'seed_payment_bruno_1',
      stripePaymentIntentId: 'pi_seed_bruno_1',
      stripeCheckoutSessionId: 'cs_seed_bruno_1',
      amount: '9.99',
      currency: 'EUR',
      description: 'Headshot unlock — full-resolution set',
      status: 'requires_payment_method',
      userId: 'seed_user_bruno',
      metadata: { jobId: 'seed_job_bruno_locked', product: 'headshot_unlock' },
      createdAt: daysAgo(3),
      updatedAt: daysAgo(3),
      expiresAt: daysAgo(2),
    },
  ];
  await database.insert(payments).values(seedPayments).onConflictDoNothing();

  await database
    .insert(webhookEvents)
    .values([
      {
        id: 'seed_webhook_alice_1',
        paymentId: 'seed_payment_alice_1',
        stripePaymentIntentId: 'pi_seed_alice_1',
        stripeCheckoutSessionId: 'cs_seed_alice_1',
        eventType: 'checkout.session.completed',
        status: 'succeeded',
        processed: true,
        processedAt: daysAgo(10),
        payload: { seed: true, type: 'checkout.session.completed' },
        createdAt: daysAgo(10),
      },
    ])
    .onConflictDoNothing();

  // --- Headshot jobs + generated images ---------------------------------
  const [corporate, businessCasual] = HEADSHOT_STYLES;
  const seedJobs = [
    {
      id: 'seed_job_alice_done',
      userId: 'seed_user_alice',
      sourceImageKey: 'headshots/seed_user_alice/source.jpg',
      styleId: corporate.id,
      status: 'completed',
      unlocked: true,
      paymentId: 'seed_payment_alice_1',
      freeRegenUsed: true,
      createdAt: daysAgo(10),
      updatedAt: daysAgo(10),
    },
    {
      id: 'seed_job_bruno_locked',
      userId: 'seed_user_bruno',
      sourceImageKey: 'headshots/seed_user_bruno/source.jpg',
      styleId: businessCasual.id,
      status: 'completed',
      unlocked: false,
      freeRegenUsed: false,
      createdAt: daysAgo(3),
      updatedAt: daysAgo(3),
    },
    {
      id: 'seed_job_bruno_pending',
      userId: 'seed_user_bruno',
      sourceImageKey: 'headshots/seed_user_bruno/source-2.jpg',
      status: 'pending',
      unlocked: false,
      freeRegenUsed: false,
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },
  ];
  await database.insert(headshotJobs).values(seedJobs).onConflictDoNothing();

  const completedJobs = [
    { jobId: 'seed_job_alice_done', styleId: corporate.id, unlocked: true, age: 10 },
    { jobId: 'seed_job_bruno_locked', styleId: businessCasual.id, unlocked: false, age: 3 },
  ];
  const seedImages = completedJobs.flatMap(({ jobId, styleId, unlocked, age }) =>
    Array.from({ length: HEADSHOT_VARIANT_COUNT }, (_, i) => ({
      id: `${jobId.replace('seed_job', 'seed_image')}_v${i + 1}`,
      jobId,
      previewKey: `headshots/${jobId}/preview-${i + 1}.jpg`,
      fullKey: unlocked ? `headshots/${jobId}/full-${i + 1}.jpg` : null,
      styleVariant: `${styleId}-v${i + 1}`,
      createdAt: daysAgo(age),
    })),
  );
  await database.insert(headshotImages).values(seedImages).onConflictDoNothing();

  // --- Summary ----------------------------------------------------------
  const counts = await database.execute(rawSql`
    SELECT 'user' AS t, count(*)::int AS c FROM "user"
    UNION ALL SELECT 'payments', count(*)::int FROM payments
    UNION ALL SELECT 'webhook_events', count(*)::int FROM webhook_events
    UNION ALL SELECT 'headshot_jobs', count(*)::int FROM headshot_jobs
    UNION ALL SELECT 'headshot_images', count(*)::int FROM headshot_images
  `);
  console.log('Seed complete. Row counts:');
  for (const row of counts) {
    console.log(`  ${String(row.t).padEnd(18)} ${row.c}`);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});

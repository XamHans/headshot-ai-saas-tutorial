import { boolean, integer, pgSchema, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

// Use 'test' schema for test environment, 'public' for production
const isTest = process.env.NODE_ENV === 'test';
const testSchema = pgSchema('test');
const tableHelper = isTest ? testSchema.table : pgTable;

/**
 * A single headshot generation job. Created once a source photo passes the
 * pre-flight face gate and is stored in R2. Style pick + generation happen in
 * a later slice — those columns (`styleId`, `paymentId`, image rows) stay
 * empty until then.
 */
export const headshotJobs = tableHelper('headshot_jobs', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),
  sourceImageKey: text('source_image_key').notNull(),
  styleId: text('style_id'),
  status: text('status').default('pending').notNull(),
  unlocked: boolean('unlocked').default(false).notNull(),
  paymentId: text('payment_id'),
  freeRegenUsed: boolean('free_regen_used').default(false).notNull(),
  createdAt: timestamp('created_at')
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp('updated_at')
    .$defaultFn(() => new Date())
    .notNull(),
});

/**
 * Fixed-window rate-limit counters for the generation endpoint, keyed on
 * `ip + fingerprint`. One row per key per window; the count is incremented
 * atomically (upsert with an increment on conflict). A request is throttled
 * once `count` exceeds the per-window limit before the window rolls over.
 */
export const headshotRateLimits = tableHelper('headshot_rate_limits', {
  key: text('key').primaryKey(),
  windowStart: timestamp('window_start').notNull(),
  count: integer('count').default(0).notNull(),
});

/**
 * Generated headshot images belonging to a job. Only created here for the
 * one-time migration — no rows are written until the generation slice.
 */
export const headshotImages = tableHelper('headshot_images', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  jobId: text('job_id')
    .notNull()
    .references(() => headshotJobs.id),
  previewKey: text('preview_key'),
  fullKey: text('full_key'),
  styleVariant: text('style_variant'),
  createdAt: timestamp('created_at')
    .$defaultFn(() => new Date())
    .notNull(),
});

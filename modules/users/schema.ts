import { boolean, integer, pgSchema, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

// Use 'test' schema for test environment, 'public' for production
const isTest = process.env.NODE_ENV === 'test';
const testSchema = pgSchema('test');
const tableHelper = (isTest ? testSchema.table : pgTable) as typeof pgTable;

// Users table
// Better Auth tables
export const user = tableHelper('user', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified')
    .$defaultFn(() => false)
    .notNull(),
  image: text('image'),
  avatar: text('avatar'),
  bio: text('bio'),
  provider: text('provider'),
  providerId: text('provider_id'),
  biometricConsentAt: timestamp('biometric_consent_at'),
  // Free-generation cap: how many of the account's free generations (see
  // FREE_GENERATION_LIMIT in headshot.service.ts) have been consumed. Incremented
  // via a race-safe conditional UPDATE (only when count < limit) so concurrent
  // first-generations can't all win once the cap is reached.
  headshotFreeGenerationCount: integer('headshot_free_generation_count').default(0).notNull(),
  createdAt: timestamp('created_at')
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp('updated_at')
    .$defaultFn(() => new Date())
    .notNull(),
});

export const session = tableHelper('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull(),
});

export const account = tableHelper('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const verification = tableHelper('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at').$defaultFn(() => new Date()),
});

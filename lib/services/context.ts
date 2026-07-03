import type * as schema from '@/lib/db';
import type { CustomLogger } from '@/lib/logger';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

/**
 * Core context required by all services.
 * Contains database connection and logger.
 */
export interface ServiceContext {
  db: PostgresJsDatabase<typeof schema>;
  logger: CustomLogger;
}

import { db as getDb } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import type { ServiceContext } from './context';

/**
 * Creates a new service context with database and logger.
 * Use this in tests to create isolated contexts.
 */
export function createServiceContext(): ServiceContext {
  const db = getDb();
  const logger = createLogger({ service: 'app' });
  return { db, logger };
}

// Singleton for production use
let defaultContext: ServiceContext | null = null;

/**
 * Returns the singleton service context.
 * Use this in API routes and production code.
 */
export function getServiceContext(): ServiceContext {
  if (!defaultContext) {
    defaultContext = createServiceContext();
  }
  return defaultContext;
}

// Re-export types
export type { ServiceContext } from './context';

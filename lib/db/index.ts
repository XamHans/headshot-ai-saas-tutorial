import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import schema from './schema';

// Removed dotenv.config() and made connection lazy-loaded
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('DATABASE_URL is not set. Database operations will fail.');
}

// Create connection only when DATABASE_URL is available
let client: postgres.Sql | null = null;
let db: any = null;

function getDb() {
  if (!db && connectionString) {
    console.log('Connecting to the database...', connectionString);

    client = postgres(connectionString, { prepare: false });
    db = drizzle(client, { schema });
  }
  return db;
}

function getClient() {
  if (!client && connectionString) {
    client = postgres(connectionString, { prepare: false });
  }
  return client;
}

export { getClient as client, getDb as db };

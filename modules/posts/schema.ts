import { boolean, pgSchema, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

// Use 'test' schema for test environment, 'public' for production
const isTest = process.env.NODE_ENV === 'test';
const testSchema = pgSchema('test');

const tableHelper = isTest ? testSchema.table : pgTable;

export const posts = tableHelper('posts', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text('title').notNull(),
  content: text('content').notNull(),
  authorId: text('author_id').notNull(),
  published: boolean('published').default(false).notNull(),
  createdAt: timestamp('created_at')
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp('updated_at')
    .$defaultFn(() => new Date())
    .notNull(),
});

import type { user } from './schema';

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;

export interface CreateUserRequest {
  email: string;
  name?: string;
  avatar?: string;
  provider: string;
  providerId: string;
}

export interface UpdateUserRequest {
  name?: string;
  avatar?: string;
  bio?: string;
}

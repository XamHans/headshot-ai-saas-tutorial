import type { users } from '../schema';

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

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

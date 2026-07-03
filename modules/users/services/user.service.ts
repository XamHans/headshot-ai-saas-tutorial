import { eq } from 'drizzle-orm';
import type { ServiceContext } from '@/lib/services/context';
import { getServiceContext } from '@/lib/services';
import { user } from '../schema';

export class UserService {
  constructor(private ctx: ServiceContext) {}

  private get logger() {
    return this.ctx.logger.child({ service: 'UserService' });
  }

  async createUser(data: {
    email: string;
    name?: string;
    avatar?: string;
    provider: string;
    providerId: string;
  }) {
    this.logger.info('Creating new user', {
      operation: 'createUser',
      email: data.email,
      provider: data.provider,
      hasName: !!data.name,
      hasAvatar: !!data.avatar,
    });

    try {
      const [newUser] = await this.ctx.db
        .insert(user)
        .values({
          email: data.email,
          name: data.name,
          avatar: data.avatar,
          provider: data.provider,
          providerId: data.providerId,
        })
        .returning();

      this.logger.info('User created successfully', {
        operation: 'createUser',
        userId: newUser.id,
        email: data.email,
      });

      return newUser;
    } catch (error) {
      this.logger.error('Failed to create user', {
        error,
        operation: 'createUser',
        email: data.email,
        provider: data.provider,
      });
      throw error;
    }
  }

  async getUserById(id: string) {
    this.logger.debug('Retrieving user by ID', {
      operation: 'getUserById',
      userId: id,
    });

    try {
      const [foundUser] = await this.ctx.db.select().from(user).where(eq(user.id, id));

      if (foundUser) {
        this.logger.debug('User found', {
          operation: 'getUserById',
          userId: id,
          userEmail: foundUser.email,
        });
      } else {
        this.logger.debug('User not found', {
          operation: 'getUserById',
          userId: id,
        });
      }

      return foundUser;
    } catch (error) {
      this.logger.error('Failed to retrieve user by ID', {
        error,
        operation: 'getUserById',
        userId: id,
      });
      throw error;
    }
  }

  async getUserByEmail(email: string) {
    this.logger.debug('Retrieving user by email', {
      operation: 'getUserByEmail',
    });

    try {
      const [foundUser] = await this.ctx.db.select().from(user).where(eq(user.email, email));

      this.logger.debug(foundUser ? 'User found by email' : 'User not found by email', {
        operation: 'getUserByEmail',
        found: !!foundUser,
      });

      return foundUser;
    } catch (error) {
      this.logger.error('Failed to retrieve user by email', {
        error,
        operation: 'getUserByEmail',
      });
      throw error;
    }
  }

  async getUserByProvider(provider: string, providerId: string) {
    this.logger.debug('Retrieving user by provider', {
      operation: 'getUserByProvider',
      provider,
      providerId,
    });

    try {
      const [foundUser] = await this.ctx.db
        .select()
        .from(user)
        .where(eq(user.provider, provider))
        .where(eq(user.providerId, providerId));

      this.logger.debug(foundUser ? 'User found by provider' : 'User not found by provider', {
        operation: 'getUserByProvider',
        provider,
        providerId,
        found: !!foundUser,
      });

      return foundUser;
    } catch (error) {
      this.logger.error('Failed to retrieve user by provider', {
        error,
        operation: 'getUserByProvider',
        provider,
        providerId,
      });
      throw error;
    }
  }

  async updateUser(
    id: string,
    data: Partial<{
      name: string;
      avatar: string;
      bio: string;
    }>,
  ) {
    this.logger.info('Updating user', {
      operation: 'updateUser',
      userId: id,
      fieldsToUpdate: Object.keys(data),
    });

    try {
      const [updatedUser] = await this.ctx.db
        .update(user)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(user.id, id))
        .returning();

      this.logger.info('User updated successfully', {
        operation: 'updateUser',
        userId: id,
        fieldsUpdated: Object.keys(data),
      });

      return updatedUser;
    } catch (error) {
      this.logger.error('Failed to update user', {
        error,
        operation: 'updateUser',
        userId: id,
        fieldsToUpdate: Object.keys(data),
      });
      throw error;
    }
  }
}

/**
 * Factory function to create a UserService instance.
 * Use this in tests to inject test database context.
 */
export function createUserService(ctx: ServiceContext): UserService {
  return new UserService(ctx);
}

/**
 * Singleton instance for production use.
 * Import this directly in API routes.
 */
export const userService = new UserService(getServiceContext());

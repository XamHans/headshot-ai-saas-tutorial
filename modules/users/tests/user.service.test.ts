import { beforeEach, describe, expect, it } from 'vitest';
import { getTestDb } from '@/tests/utils/test-database';
import { createLogger } from '@/lib/logger';
import { createUserService } from '../services/user.service';
import type { UserService } from '../services/user.service';
import type { ServiceContext } from '@/lib/services/context';

describe('UserService', () => {
  let userService: UserService;

  beforeEach(() => {
    const ctx: ServiceContext = {
      db: getTestDb(),
      logger: createLogger(), // No context - let services set their own
    };
    userService = createUserService(ctx);
  });

  describe('createUser', () => {
    it('should create a new user', async () => {
      const userData = {
        email: 'test@example.com',
        name: 'Test User',
        avatar: 'https://example.com/avatar.jpg',
        provider: 'google',
        providerId: '123456',
      };

      const user = await userService.createUser(userData);

      expect(user).toMatchObject({
        email: userData.email,
        name: userData.name,
        avatar: userData.avatar,
      });
      expect(user.id).toBeDefined();
      expect(user.createdAt).toBeDefined();
    });
  });

  describe('getUserByEmail', () => {
    it('should find user by email', async () => {
      const userData = {
        email: 'test@example.com',
        name: 'Test User',
        provider: 'google',
        providerId: '123456',
      };

      await userService.createUser(userData);
      const foundUser = await userService.getUserByEmail('test@example.com');

      expect(foundUser).toMatchObject({
        email: userData.email,
        name: userData.name,
      });
    });

    it('should return null for non-existent user', async () => {
      const foundUser = await userService.getUserByEmail('nonexistent@example.com');
      expect(foundUser).toBeUndefined();
    });
  });
});

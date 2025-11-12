/**
 * Integration tests for database repositories
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { database } from '@infrastructure/database/connection-pool';
import { userRepository } from '@infrastructure/database/repositories/user-repository';
import { messageRepository } from '@infrastructure/database/repositories/message-repository';
import { ApiError } from '@shared/errors/api-error';

describe('Database Repositories', () => {
  beforeAll(async () => {
    await database.connect();
  });

  afterAll(async () => {
    await database.disconnect();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await database.query('DELETE FROM messages');
    await database.query('DELETE FROM users');
  });

  describe('UserRepository', () => {
    describe('create', () => {
      it('should create a new user', async () => {
        const input = {
          email: 'test@example.com',
          name: 'Test User',
          password: 'hashedpassword',
        };

        const user = await userRepository.create(input);

        expect(user.id).toBeDefined();
        expect(user.email).toBe(input.email);
        expect(user.name).toBe(input.name);
        expect(user.password).toBe(input.password);
        expect(user.createdAt).toBeInstanceOf(Date);
        expect(user.updatedAt).toBeInstanceOf(Date);
      });

      it('should throw conflict error for duplicate email', async () => {
        const input = {
          email: 'duplicate@example.com',
          name: 'Test User',
          password: 'hashedpassword',
        };

        await userRepository.create(input);

        await expect(userRepository.create(input)).rejects.toThrow(ApiError);
        await expect(userRepository.create(input)).rejects.toThrow('Email already exists');
      });
    });

    describe('findById', () => {
      it('should find user by ID', async () => {
        const created = await userRepository.create({
          email: 'findbyid@example.com',
          name: 'Find By ID',
          password: 'hashedpassword',
        });

        const found = await userRepository.findById(created.id);

        expect(found).not.toBeNull();
        expect(found?.id).toBe(created.id);
        expect(found?.email).toBe(created.email);
      });

      it('should return null for nonexistent ID', async () => {
        const found = await userRepository.findById('00000000-0000-0000-0000-000000000000');

        expect(found).toBeNull();
      });
    });

    describe('findByEmail', () => {
      it('should find user by email', async () => {
        const created = await userRepository.create({
          email: 'findbyemail@example.com',
          name: 'Find By Email',
          password: 'hashedpassword',
        });

        const found = await userRepository.findByEmail(created.email);

        expect(found).not.toBeNull();
        expect(found?.id).toBe(created.id);
        expect(found?.email).toBe(created.email);
      });

      it('should return null for nonexistent email', async () => {
        const found = await userRepository.findByEmail('nonexistent@example.com');

        expect(found).toBeNull();
      });

      it('should be case-sensitive', async () => {
        await userRepository.create({
          email: 'case@example.com',
          name: 'Case Test',
          password: 'hashedpassword',
        });

        const found = await userRepository.findByEmail('CASE@example.com');

        expect(found).toBeNull();
      });
    });

    describe('update', () => {
      it('should update user name', async () => {
        const created = await userRepository.create({
          email: 'update@example.com',
          name: 'Original Name',
          password: 'hashedpassword',
        });

        const updated = await userRepository.update(created.id, { name: 'New Name' });

        expect(updated.name).toBe('New Name');
        expect(updated.email).toBe(created.email);
      });

      it('should update user email', async () => {
        const created = await userRepository.create({
          email: 'original@example.com',
          name: 'Update Email',
          password: 'hashedpassword',
        });

        const updated = await userRepository.update(created.id, { email: 'new@example.com' });

        expect(updated.email).toBe('new@example.com');
        expect(updated.name).toBe(created.name);
      });

      it('should update user password', async () => {
        const created = await userRepository.create({
          email: 'updatepw@example.com',
          name: 'Update Password',
          password: 'oldpassword',
        });

        const updated = await userRepository.update(created.id, { password: 'newpassword' });

        expect(updated.password).toBe('newpassword');
      });

      it('should update multiple fields', async () => {
        const created = await userRepository.create({
          email: 'multi@example.com',
          name: 'Multi Update',
          password: 'oldpassword',
        });

        const updated = await userRepository.update(created.id, {
          name: 'New Name',
          email: 'newemail@example.com',
        });

        expect(updated.name).toBe('New Name');
        expect(updated.email).toBe('newemail@example.com');
      });

      it('should throw not found error for nonexistent user', async () => {
        await expect(
          userRepository.update('00000000-0000-0000-0000-000000000000', { name: 'Test' })
        ).rejects.toThrow(ApiError);
      });

      it('should throw invalid input error when no fields provided', async () => {
        const created = await userRepository.create({
          email: 'nofields@example.com',
          name: 'No Fields',
          password: 'hashedpassword',
        });

        await expect(userRepository.update(created.id, {})).rejects.toThrow(ApiError);
        await expect(userRepository.update(created.id, {})).rejects.toThrow('No fields to update');
      });

      it('should throw conflict error for duplicate email', async () => {
        await userRepository.create({
          email: 'user1@example.com',
          name: 'User 1',
          password: 'hashedpassword',
        });

        const user2 = await userRepository.create({
          email: 'user2@example.com',
          name: 'User 2',
          password: 'hashedpassword',
        });

        await expect(userRepository.update(user2.id, { email: 'user1@example.com' })).rejects.toThrow(
          ApiError
        );
      });
    });

    describe('delete', () => {
      it('should delete user', async () => {
        const created = await userRepository.create({
          email: 'delete@example.com',
          name: 'Delete Test',
          password: 'hashedpassword',
        });

        await userRepository.delete(created.id);

        const found = await userRepository.findById(created.id);
        expect(found).toBeNull();
      });

      it('should throw not found error for nonexistent user', async () => {
        await expect(userRepository.delete('00000000-0000-0000-0000-000000000000')).rejects.toThrow(
          ApiError
        );
      });
    });

    describe('exists', () => {
      it('should return true for existing user', async () => {
        const created = await userRepository.create({
          email: 'exists@example.com',
          name: 'Exists Test',
          password: 'hashedpassword',
        });

        const exists = await userRepository.exists(created.id);

        expect(exists).toBe(true);
      });

      it('should return false for nonexistent user', async () => {
        const exists = await userRepository.exists('00000000-0000-0000-0000-000000000000');

        expect(exists).toBe(false);
      });
    });

    describe('count', () => {
      it('should return user count', async () => {
        expect(await userRepository.count()).toBe(0);

        await userRepository.create({
          email: 'count1@example.com',
          name: 'Count 1',
          password: 'hashedpassword',
        });
        expect(await userRepository.count()).toBe(1);

        await userRepository.create({
          email: 'count2@example.com',
          name: 'Count 2',
          password: 'hashedpassword',
        });
        expect(await userRepository.count()).toBe(2);
      });
    });
  });

  describe('MessageRepository', () => {
    let testUserId: string;

    beforeEach(async () => {
      // Create a test user for message tests
      const user = await userRepository.create({
        email: 'messagetest@example.com',
        name: 'Message Test',
        password: 'hashedpassword',
      });
      testUserId = user.id;
    });

    describe('create', () => {
      it('should create a new message', async () => {
        const input = {
          userId: testUserId,
          content: 'Test message content',
        };

        const message = await messageRepository.create(input);

        expect(message.id).toBeDefined();
        expect(message.userId).toBe(testUserId);
        expect(message.content).toBe(input.content);
        expect(message.createdAt).toBeInstanceOf(Date);
      });
    });

    describe('findById', () => {
      it('should find message by ID', async () => {
        const created = await messageRepository.create({
          userId: testUserId,
          content: 'Find by ID message',
        });

        const found = await messageRepository.findById(created.id);

        expect(found).not.toBeNull();
        expect(found?.id).toBe(created.id);
        expect(found?.content).toBe(created.content);
      });

      it('should return null for nonexistent ID', async () => {
        const found = await messageRepository.findById('00000000-0000-0000-0000-000000000000');

        expect(found).toBeNull();
      });
    });

    describe('findAll', () => {
      beforeEach(async () => {
        // Create test messages
        for (let i = 1; i <= 25; i++) {
          await messageRepository.create({
            userId: testUserId,
            content: `Message ${i}`,
          });
        }
      });

      it('should return paginated messages', async () => {
        const result = await messageRepository.findAll({ page: 1, limit: 20 });

        expect(result.data).toHaveLength(20);
        expect(result.pagination.page).toBe(1);
        expect(result.pagination.limit).toBe(20);
        expect(result.pagination.total).toBe(25);
        expect(result.pagination.totalPages).toBe(2);
      });

      it('should return second page', async () => {
        const result = await messageRepository.findAll({ page: 2, limit: 20 });

        expect(result.data).toHaveLength(5);
        expect(result.pagination.page).toBe(2);
      });

      it('should handle custom limit', async () => {
        const result = await messageRepository.findAll({ page: 1, limit: 10 });

        expect(result.data).toHaveLength(10);
        expect(result.pagination.totalPages).toBe(3);
      });
    });

    describe('findByUserId', () => {
      beforeEach(async () => {
        // Create messages for test user
        for (let i = 1; i <= 5; i++) {
          await messageRepository.create({
            userId: testUserId,
            content: `User message ${i}`,
          });
        }

        // Create another user with different messages
        const otherUser = await userRepository.create({
          email: 'other@example.com',
          name: 'Other User',
          password: 'hashedpassword',
        });
        await messageRepository.create({
          userId: otherUser.id,
          content: 'Other user message',
        });
      });

      it('should find messages by user ID', async () => {
        const result = await messageRepository.findByUserId(testUserId, { page: 1, limit: 20 });

        expect(result.data).toHaveLength(5);
        expect(result.data.every((m) => m.userId === testUserId)).toBe(true);
      });

      it('should return empty array for user with no messages', async () => {
        const newUser = await userRepository.create({
          email: 'nomessages@example.com',
          name: 'No Messages',
          password: 'hashedpassword',
        });

        const result = await messageRepository.findByUserId(newUser.id, { page: 1, limit: 20 });

        expect(result.data).toHaveLength(0);
        expect(result.pagination.total).toBe(0);
      });
    });

    describe('delete', () => {
      it('should delete message', async () => {
        const created = await messageRepository.create({
          userId: testUserId,
          content: 'Delete test message',
        });

        await messageRepository.delete(created.id);

        const found = await messageRepository.findById(created.id);
        expect(found).toBeNull();
      });

      it('should throw not found error for nonexistent message', async () => {
        await expect(
          messageRepository.delete('00000000-0000-0000-0000-000000000000')
        ).rejects.toThrow(ApiError);
      });
    });

    describe('count', () => {
      it('should return message count', async () => {
        expect(await messageRepository.count()).toBe(0);

        await messageRepository.create({
          userId: testUserId,
          content: 'Message 1',
        });
        expect(await messageRepository.count()).toBe(1);

        await messageRepository.create({
          userId: testUserId,
          content: 'Message 2',
        });
        expect(await messageRepository.count()).toBe(2);
      });
    });
  });

  describe('Database Transactions', () => {
    it('should commit successful transaction', async () => {
      const result = await database.transaction(async (client) => {
        await client.query(
          `INSERT INTO users (email, name, password) VALUES ($1, $2, $3)`,
          ['transaction@example.com', 'Transaction Test', 'hashedpassword']
        );

        return 'success';
      });

      expect(result).toBe('success');

      // Verify user was created
      const user = await userRepository.findByEmail('transaction@example.com');
      expect(user).not.toBeNull();
    });

    it('should rollback failed transaction', async () => {
      try {
        await database.transaction(async (client) => {
          await client.query(
            `INSERT INTO users (email, name, password) VALUES ($1, $2, $3)`,
            ['rollback@example.com', 'Rollback Test', 'hashedpassword']
          );

          // Simulate error
          throw new Error('Transaction failed');
        });
      } catch (error) {
        // Expected to throw
      }

      // Verify user was NOT created
      const user = await userRepository.findByEmail('rollback@example.com');
      expect(user).toBeNull();
    });
  });
});

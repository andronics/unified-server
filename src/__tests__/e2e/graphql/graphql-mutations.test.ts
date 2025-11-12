/**
 * GraphQL Mutations E2E Tests
 *
 * Tests all GraphQL mutation operations end-to-end
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { Server } from 'http';
import type { Express } from 'express';
import { httpServer } from '@protocols/http/http-server';
import { database } from '@infrastructure/database/connection-pool';
import { redisClient } from '@infrastructure/cache/redis-client';

describe('GraphQL Mutations E2E', () => {
  let server: Server;
  let app: Express;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    await database.connect();

    app = httpServer['app'];

    server = await new Promise<Server>((resolve) => {
      const srv = app.listen(0, () => resolve(srv));
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await database.disconnect();
    await redisClient.disconnect();
  });

  beforeEach(async () => {
    await database.query('DELETE FROM messages');
    await database.query('DELETE FROM users');
  });

  describe('register Mutation', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({
          query: `
            mutation Register($input: RegisterInput!) {
              register(input: $input) {
                user {
                  id
                  email
                  name
                  createdAt
                  updatedAt
                }
                token
              }
            }
          `,
          variables: {
            input: {
              email: 'newuser@example.com',
              name: 'New User',
              password: 'SecurePass123!',
            },
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.data.register).toBeDefined();
      expect(response.body.data.register.user.email).toBe('newuser@example.com');
      expect(response.body.data.register.user.name).toBe('New User');
      expect(response.body.data.register.token).toBeDefined();
      expect(typeof response.body.data.register.token).toBe('string');
    });

    it('should fail with invalid email', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({
          query: `
            mutation Register($input: RegisterInput!) {
              register(input: $input) {
                user {
                  id
                }
                token
              }
            }
          `,
          variables: {
            input: {
              email: 'invalid-email',
              name: 'Test User',
              password: 'SecurePass123!',
            },
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('email');
    });

    it('should fail with weak password', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({
          query: `
            mutation Register($input: RegisterInput!) {
              register(input: $input) {
                user {
                  id
                }
                token
              }
            }
          `,
          variables: {
            input: {
              email: 'test@example.com',
              name: 'Test User',
              password: '123',
            },
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('password');
    });

    it('should fail with duplicate email', async () => {
      // First registration
      await request(app)
        .post('/graphql')
        .send({
          query: `
            mutation Register($input: RegisterInput!) {
              register(input: $input) {
                user {
                  id
                }
                token
              }
            }
          `,
          variables: {
            input: {
              email: 'duplicate@example.com',
              name: 'First User',
              password: 'SecurePass123!',
            },
          },
        });

      // Attempt duplicate registration
      const response = await request(app)
        .post('/graphql')
        .send({
          query: `
            mutation Register($input: RegisterInput!) {
              register(input: $input) {
                user {
                  id
                }
                token
              }
            }
          `,
          variables: {
            input: {
              email: 'duplicate@example.com',
              name: 'Second User',
              password: 'SecurePass123!',
            },
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('already exists');
    });
  });

  describe('login Mutation', () => {
    beforeEach(async () => {
      // Create test user
      const registerResponse = await request(app)
        .post('/graphql')
        .send({
          query: `
            mutation Register($input: RegisterInput!) {
              register(input: $input) {
                user {
                  id
                }
                token
              }
            }
          `,
          variables: {
            input: {
              email: 'login.test@example.com',
              name: 'Login Test User',
              password: 'SecurePass123!',
            },
          },
        });

      userId = registerResponse.body.data.register.user.id;
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({
          query: `
            mutation Login($input: LoginInput!) {
              login(input: $input) {
                user {
                  id
                  email
                  name
                }
                token
              }
            }
          `,
          variables: {
            input: {
              email: 'login.test@example.com',
              password: 'SecurePass123!',
            },
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.data.login).toBeDefined();
      expect(response.body.data.login.user.email).toBe('login.test@example.com');
      expect(response.body.data.login.token).toBeDefined();
    });

    it('should fail with invalid password', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({
          query: `
            mutation Login($input: LoginInput!) {
              login(input: $input) {
                user {
                  id
                }
                token
              }
            }
          `,
          variables: {
            input: {
              email: 'login.test@example.com',
              password: 'WrongPassword123!',
            },
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('Invalid credentials');
    });

    it('should fail with non-existent email', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({
          query: `
            mutation Login($input: LoginInput!) {
              login(input: $input) {
                user {
                  id
                }
                token
              }
            }
          `,
          variables: {
            input: {
              email: 'nonexistent@example.com',
              password: 'SecurePass123!',
            },
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('User not found');
    });
  });

  describe('updateUser Mutation', () => {
    beforeEach(async () => {
      // Create and authenticate user
      const registerResponse = await request(app)
        .post('/graphql')
        .send({
          query: `
            mutation Register($input: RegisterInput!) {
              register(input: $input) {
                user {
                  id
                }
                token
              }
            }
          `,
          variables: {
            input: {
              email: 'update.test@example.com',
              name: 'Update Test User',
              password: 'SecurePass123!',
            },
          },
        });

      authToken = registerResponse.body.data.register.token;
      userId = registerResponse.body.data.register.user.id;
    });

    it('should update user name', async () => {
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          query: `
            mutation UpdateUser($input: UpdateUserInput!) {
              updateUser(input: $input) {
                id
                name
                email
                updatedAt
              }
            }
          `,
          variables: {
            input: {
              name: 'Updated Name',
            },
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.data.updateUser).toBeDefined();
      expect(response.body.data.updateUser.name).toBe('Updated Name');
      expect(response.body.data.updateUser.email).toBe('update.test@example.com');
    });

    it('should update user email', async () => {
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          query: `
            mutation UpdateUser($input: UpdateUserInput!) {
              updateUser(input: $input) {
                id
                name
                email
              }
            }
          `,
          variables: {
            input: {
              email: 'newemail@example.com',
            },
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.data.updateUser).toBeDefined();
      expect(response.body.data.updateUser.email).toBe('newemail@example.com');
    });

    it('should update both name and email', async () => {
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          query: `
            mutation UpdateUser($input: UpdateUserInput!) {
              updateUser(input: $input) {
                id
                name
                email
              }
            }
          `,
          variables: {
            input: {
              name: 'Completely New Name',
              email: 'completelynew@example.com',
            },
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.data.updateUser.name).toBe('Completely New Name');
      expect(response.body.data.updateUser.email).toBe('completelynew@example.com');
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({
          query: `
            mutation UpdateUser($input: UpdateUserInput!) {
              updateUser(input: $input) {
                id
                name
              }
            }
          `,
          variables: {
            input: {
              name: 'Unauthorized Update',
            },
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('Authentication required');
    });

    it('should fail with invalid email format', async () => {
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          query: `
            mutation UpdateUser($input: UpdateUserInput!) {
              updateUser(input: $input) {
                id
                email
              }
            }
          `,
          variables: {
            input: {
              email: 'invalid-email-format',
            },
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('email');
    });
  });

  describe('deleteUser Mutation', () => {
    beforeEach(async () => {
      // Create and authenticate user
      const registerResponse = await request(app)
        .post('/graphql')
        .send({
          query: `
            mutation Register($input: RegisterInput!) {
              register(input: $input) {
                user {
                  id
                }
                token
              }
            }
          `,
          variables: {
            input: {
              email: 'delete.test@example.com',
              name: 'Delete Test User',
              password: 'SecurePass123!',
            },
          },
        });

      authToken = registerResponse.body.data.register.token;
      userId = registerResponse.body.data.register.user.id;
    });

    it('should delete authenticated user', async () => {
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          query: `
            mutation DeleteUser {
              deleteUser
            }
          `,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.deleteUser).toBe(true);

      // Verify user is deleted
      const checkResponse = await request(app)
        .post('/graphql')
        .send({
          query: `
            query GetUser($id: ID!) {
              user(id: $id) {
                id
              }
            }
          `,
          variables: {
            id: userId,
          },
        });

      expect(checkResponse.body.data.user).toBeNull();
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({
          query: `
            mutation DeleteUser {
              deleteUser
            }
          `,
        });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('Authentication required');
    });
  });

  describe('sendMessage Mutation', () => {
    let recipientId: string;

    beforeEach(async () => {
      // Create sender
      const senderResponse = await request(app)
        .post('/graphql')
        .send({
          query: `
            mutation Register($input: RegisterInput!) {
              register(input: $input) {
                user {
                  id
                }
                token
              }
            }
          `,
          variables: {
            input: {
              email: 'sender@example.com',
              name: 'Sender User',
              password: 'SecurePass123!',
            },
          },
        });

      authToken = senderResponse.body.data.register.token;
      userId = senderResponse.body.data.register.user.id;

      // Create recipient
      const recipientResponse = await request(app)
        .post('/graphql')
        .send({
          query: `
            mutation Register($input: RegisterInput!) {
              register(input: $input) {
                user {
                  id
                }
                token
              }
            }
          `,
          variables: {
            input: {
              email: 'recipient@example.com',
              name: 'Recipient User',
              password: 'SecurePass123!',
            },
          },
        });

      recipientId = recipientResponse.body.data.register.user.id;
    });

    it('should send message to recipient', async () => {
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          query: `
            mutation SendMessage($input: SendMessageInput!) {
              sendMessage(input: $input) {
                id
                content
                userId
                recipientId
                user {
                  id
                  name
                }
                createdAt
              }
            }
          `,
          variables: {
            input: {
              content: 'Hello, this is a test message!',
              recipientId: recipientId,
            },
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.data.sendMessage).toBeDefined();
      expect(response.body.data.sendMessage.content).toBe('Hello, this is a test message!');
      expect(response.body.data.sendMessage.userId).toBe(userId);
      expect(response.body.data.sendMessage.recipientId).toBe(recipientId);
      expect(response.body.data.sendMessage.user.name).toBe('Sender User');
    });

    it('should send message to channel', async () => {
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          query: `
            mutation SendMessage($input: SendMessageInput!) {
              sendMessage(input: $input) {
                id
                content
                channelId
                userId
              }
            }
          `,
          variables: {
            input: {
              content: 'Channel message',
              channelId: 'general',
            },
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.data.sendMessage).toBeDefined();
      expect(response.body.data.sendMessage.content).toBe('Channel message');
      expect(response.body.data.sendMessage.channelId).toBe('general');
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({
          query: `
            mutation SendMessage($input: SendMessageInput!) {
              sendMessage(input: $input) {
                id
              }
            }
          `,
          variables: {
            input: {
              content: 'Unauthorized message',
              recipientId: recipientId,
            },
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('Authentication required');
    });

    it('should fail with empty content', async () => {
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          query: `
            mutation SendMessage($input: SendMessageInput!) {
              sendMessage(input: $input) {
                id
              }
            }
          `,
          variables: {
            input: {
              content: '',
              recipientId: recipientId,
            },
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('content');
    });

    it('should fail without recipient or channel', async () => {
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          query: `
            mutation SendMessage($input: SendMessageInput!) {
              sendMessage(input: $input) {
                id
              }
            }
          `,
          variables: {
            input: {
              content: 'Message to nowhere',
            },
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('deleteMessage Mutation', () => {
    let messageId: string;

    beforeEach(async () => {
      // Create user and authenticate
      const registerResponse = await request(app)
        .post('/graphql')
        .send({
          query: `
            mutation Register($input: RegisterInput!) {
              register(input: $input) {
                user {
                  id
                }
                token
              }
            }
          `,
          variables: {
            input: {
              email: 'message.delete@example.com',
              name: 'Message Delete User',
              password: 'SecurePass123!',
            },
          },
        });

      authToken = registerResponse.body.data.register.token;
      userId = registerResponse.body.data.register.user.id;

      // Create message
      const messageResponse = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          query: `
            mutation SendMessage($input: SendMessageInput!) {
              sendMessage(input: $input) {
                id
              }
            }
          `,
          variables: {
            input: {
              content: 'Message to be deleted',
              recipientId: userId,
            },
          },
        });

      messageId = messageResponse.body.data.sendMessage.id;
    });

    it('should delete own message', async () => {
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          query: `
            mutation DeleteMessage($id: ID!) {
              deleteMessage(id: $id)
            }
          `,
          variables: {
            id: messageId,
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.data.deleteMessage).toBe(true);

      // Verify message is deleted
      const checkResponse = await request(app)
        .post('/graphql')
        .send({
          query: `
            query GetMessage($id: ID!) {
              message(id: $id) {
                id
              }
            }
          `,
          variables: {
            id: messageId,
          },
        });

      expect(checkResponse.body.data.message).toBeNull();
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({
          query: `
            mutation DeleteMessage($id: ID!) {
              deleteMessage(id: $id)
            }
          `,
          variables: {
            id: messageId,
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('Authentication required');
    });

    it('should fail when deleting non-existent message', async () => {
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          query: `
            mutation DeleteMessage($id: ID!) {
              deleteMessage(id: $id)
            }
          `,
          variables: {
            id: '00000000-0000-0000-0000-000000000000',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('not found');
    });

    it('should fail when deleting another user\'s message', async () => {
      // Create another user
      const otherUserResponse = await request(app)
        .post('/graphql')
        .send({
          query: `
            mutation Register($input: RegisterInput!) {
              register(input: $input) {
                user {
                  id
                }
                token
              }
            }
          `,
          variables: {
            input: {
              email: 'other@example.com',
              name: 'Other User',
              password: 'SecurePass123!',
            },
          },
        });

      const otherToken = otherUserResponse.body.data.register.token;

      // Try to delete original user's message
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          query: `
            mutation DeleteMessage($id: ID!) {
              deleteMessage(id: $id)
            }
          `,
          variables: {
            id: messageId,
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('not authorized');
    });
  });

  describe('Mutation Error Handling', () => {
    it('should handle malformed input gracefully', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({
          query: `
            mutation Register($input: RegisterInput!) {
              register(input: $input) {
                user {
                  id
                }
                token
              }
            }
          `,
          variables: {
            input: {
              // Missing required fields
            },
          },
        });

      // GraphQL Yoga returns 200 with errors in body for validation errors
      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
    });

    it('should handle type mismatches', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({
          query: `
            mutation SendMessage($input: SendMessageInput!) {
              sendMessage(input: $input) {
                id
              }
            }
          `,
          variables: {
            input: {
              content: 123, // Should be string
              recipientId: 'test-id',
            },
          },
        });

      // GraphQL Yoga returns 200 with errors in body for type errors
      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
    });
  });
});

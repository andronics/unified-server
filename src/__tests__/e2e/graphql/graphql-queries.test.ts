/**
 * GraphQL Queries E2E Tests
 *
 * Tests all GraphQL query operations end-to-end
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { Server } from 'http';
import type { Express } from 'express';
import { httpServer } from '@protocols/http/http-server';
import { database } from '@infrastructure/database/connection-pool';
import { redisClient } from '@infrastructure/cache/redis-client';

describe('GraphQL Queries E2E', () => {
  let server: Server;
  let app: Express;
  let authToken: string;
  let userId: string;
  let messageId: string;

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

    // Create test user and get auth token
    const registerResponse = await request(app)
      .post('/graphql')
      .send({
        query: `
          mutation Register($input: RegisterInput!) {
            register(input: $input) {
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
            email: 'query.test@example.com',
            name: 'Query Test User',
            password: 'SecurePass123!',
          },
        },
      });

    authToken = registerResponse.body.data.register.token;
    userId = registerResponse.body.data.register.user.id;

    // Create test message
    const messageResponse = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        query: `
          mutation SendMessage($input: SendMessageInput!) {
            sendMessage(input: $input) {
              id
              content
            }
          }
        `,
        variables: {
          input: {
            content: 'Test message for query tests',
            recipientId: userId,
          },
        },
      });

    messageId = messageResponse.body.data.sendMessage.id;
  });

  describe('user Query', () => {
    it('should retrieve user by ID', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({
          query: `
            query GetUser($id: ID!) {
              user(id: $id) {
                id
                email
                name
                createdAt
                updatedAt
              }
            }
          `,
          variables: {
            id: userId,
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.id).toBe(userId);
      expect(response.body.data.user.email).toBe('query.test@example.com');
      expect(response.body.data.user.name).toBe('Query Test User');
    });

    it('should return null for non-existent user', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({
          query: `
            query GetUser($id: ID!) {
              user(id: $id) {
                id
                email
              }
            }
          `,
          variables: {
            id: '00000000-0000-0000-0000-000000000000',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.data.user).toBeNull();
    });
  });

  describe('me Query', () => {
    it('should retrieve authenticated user', async () => {
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          query: `
            query Me {
              me {
                id
                email
                name
                createdAt
                updatedAt
              }
            }
          `,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.me).toBeDefined();
      expect(response.body.data.me.id).toBe(userId);
      expect(response.body.data.me.email).toBe('query.test@example.com');
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({
          query: `
            query Me {
              me {
                id
                email
              }
            }
          `,
        });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('Authentication required');
    });
  });

  describe('message Query', () => {
    it('should retrieve message by ID', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({
          query: `
            query GetMessage($id: ID!) {
              message(id: $id) {
                id
                content
                userId
                user {
                  id
                  name
                }
                recipientId
                createdAt
              }
            }
          `,
          variables: {
            id: messageId,
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.data.message).toBeDefined();
      expect(response.body.data.message.id).toBe(messageId);
      expect(response.body.data.message.content).toBe('Test message for query tests');
      expect(response.body.data.message.user.name).toBe('Query Test User');
    });

    it('should return null for non-existent message', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({
          query: `
            query GetMessage($id: ID!) {
              message(id: $id) {
                id
                content
              }
            }
          `,
          variables: {
            id: '00000000-0000-0000-0000-000000000000',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.data.message).toBeNull();
    });
  });

  describe('messages Query (Pagination)', () => {
    beforeEach(async () => {
      // Create multiple messages for pagination testing
      for (let i = 1; i <= 25; i++) {
        await request(app)
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
                content: `Test message ${i}`,
                recipientId: userId,
              },
            },
          });
      }
    });

    it('should retrieve paginated messages (first page)', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({
          query: `
            query GetMessages($page: Int, $limit: Int) {
              messages(page: $page, limit: $limit) {
                edges {
                  node {
                    id
                    content
                  }
                  cursor
                }
                pageInfo {
                  page
                  limit
                  total
                  totalPages
                  hasNextPage
                  hasPreviousPage
                }
              }
            }
          `,
          variables: {
            page: 1,
            limit: 10,
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.data.messages).toBeDefined();
      expect(response.body.data.messages.edges.length).toBe(10);
      expect(response.body.data.messages.pageInfo.page).toBe(1);
      expect(response.body.data.messages.pageInfo.total).toBe(26); // 25 + initial message
      expect(response.body.data.messages.pageInfo.hasNextPage).toBe(true);
      expect(response.body.data.messages.pageInfo.hasPreviousPage).toBe(false);
    });

    it('should retrieve paginated messages (second page)', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({
          query: `
            query GetMessages($page: Int, $limit: Int) {
              messages(page: $page, limit: $limit) {
                edges {
                  node {
                    id
                    content
                  }
                }
                pageInfo {
                  page
                  limit
                  total
                  totalPages
                  hasNextPage
                  hasPreviousPage
                }
              }
            }
          `,
          variables: {
            page: 2,
            limit: 10,
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.data.messages.edges.length).toBe(10);
      expect(response.body.data.messages.pageInfo.page).toBe(2);
      expect(response.body.data.messages.pageInfo.hasNextPage).toBe(true);
      expect(response.body.data.messages.pageInfo.hasPreviousPage).toBe(true);
    });

    it('should use default pagination params', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({
          query: `
            query GetMessages {
              messages {
                edges {
                  node {
                    id
                  }
                }
                pageInfo {
                  page
                  limit
                }
              }
            }
          `,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.messages.pageInfo.page).toBe(1);
      expect(response.body.data.messages.pageInfo.limit).toBe(20);
    });
  });

  describe('userMessages Query', () => {
    it('should retrieve messages from specific user', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({
          query: `
            query GetUserMessages($userId: ID!) {
              userMessages(userId: $userId) {
                edges {
                  node {
                    id
                    content
                    userId
                  }
                }
                pageInfo {
                  total
                }
              }
            }
          `,
          variables: {
            userId,
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.data.userMessages).toBeDefined();
      expect(response.body.data.userMessages.pageInfo.total).toBeGreaterThan(0);
      expect(response.body.data.userMessages.edges[0].node.userId).toBe(userId);
    });
  });

  describe('channelMessages Query', () => {
    beforeEach(async () => {
      // Create channel message
      await request(app)
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
              content: 'Channel message',
              channelId: 'test-channel',
            },
          },
        });
    });

    it('should retrieve messages from specific channel', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({
          query: `
            query GetChannelMessages($channelId: ID!) {
              channelMessages(channelId: $channelId) {
                edges {
                  node {
                    id
                    content
                    channelId
                  }
                }
                pageInfo {
                  total
                }
              }
            }
          `,
          variables: {
            channelId: 'test-channel',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.data.channelMessages).toBeDefined();
      expect(response.body.data.channelMessages.pageInfo.total).toBeGreaterThan(0);
      expect(response.body.data.channelMessages.edges[0].node.channelId).toBe('test-channel');
    });
  });

  describe('Query Error Handling', () => {
    it('should handle invalid GraphQL syntax', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({
          query: `
            query InvalidSyntax {
              user(id: INVALID_SYNTAX) {
                id
              }
            }
          `,
        });

      // GraphQL Yoga returns 200 with errors in body for syntax errors
      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
    });

    it('should handle missing required variables', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({
          query: `
            query GetUser($id: ID!) {
              user(id: $id) {
                id
              }
            }
          `,
          // Missing variables
        });

      // GraphQL Yoga returns 200 with errors in body for validation errors
      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
    });
  });
});

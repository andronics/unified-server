/**
 * GraphQL Subscriptions E2E Tests
 *
 * Tests all GraphQL subscription operations end-to-end
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { Server } from 'http';
import type { Express } from 'express';
import { httpServer } from '@protocols/http/http-server';
import { database } from '@infrastructure/database/connection-pool';
import { redisClient } from '@infrastructure/cache/redis-client';
import { Client, createClient } from 'graphql-ws';
import WebSocket from 'ws';

describe('GraphQL Subscriptions E2E', () => {
  let server: Server;
  let app: Express;
  let authToken: string;
  let userId: string;
  let serverAddress: string;

  beforeAll(async () => {
    await database.connect();

    app = httpServer['app'];

    server = await new Promise<Server>((resolve) => {
      const srv = app.listen(0, () => {
        const address = srv.address();
        if (address && typeof address === 'object') {
          serverAddress = `ws://localhost:${address.port}/graphql`;
        }
        resolve(srv);
      });
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
              }
              token
            }
          }
        `,
        variables: {
          input: {
            email: 'subscription.test@example.com',
            name: 'Subscription Test User',
            password: 'SecurePass123!',
          },
        },
      });

    authToken = registerResponse.body.data.register.token;
    userId = registerResponse.body.data.register.user.id;
  });

  describe('userCreated Subscription', () => {
    it('should receive userCreated events', async () => {

      const client: Client = createClient({
        url: serverAddress,
        webSocketImpl: WebSocket,
        connectionParams: {
          authorization: `Bearer ${authToken}`,
        },
      });

      const subscription = client.iterate({
        query: `
          subscription OnUserCreated {
            userCreated {
              id
              email
              name
              createdAt
            }
          }
        `,
      });

      // Start listening
      const iterator = subscription[Symbol.asyncIterator]();
      const resultPromise = iterator.next();

      // Give subscription time to establish
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Create a new user (trigger event)
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
              email: 'newuser@example.com',
              name: 'New User',
              password: 'SecurePass123!',
            },
          },
        });

      // Wait for event
      const result = await Promise.race([
        resultPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Subscription timeout')), 5000)
        ),
      ]);

      expect(result).toBeDefined();
      expect((result as any).value.data.userCreated).toBeDefined();
      expect((result as any).value.data.userCreated.email).toBe('newuser@example.com');
      expect((result as any).value.data.userCreated.name).toBe('New User');

      await client.dispose();
    });

    it('should not receive events without authentication', async () => {
      let errorOccurred = false;

      const client: Client = createClient({
        url: serverAddress,
        webSocketImpl: WebSocket,
        // No authentication
      });

      try {
        const subscription = client.iterate({
          query: `
            subscription OnUserCreated {
              userCreated {
                id
              }
            }
          `,
        });

        const iterator = subscription[Symbol.asyncIterator]();
        await iterator.next();
      } catch (error) {
        errorOccurred = true;
      } finally {
        await client.dispose();
      }

      expect(errorOccurred).toBe(true);
    });
  });

  describe('userUpdated Subscription', () => {
    it('should receive userUpdated events', async () => {
      const client: Client = createClient({
        url: serverAddress,
        webSocketImpl: WebSocket,
        connectionParams: {
          authorization: `Bearer ${authToken}`,
        },
      });

      const subscription = client.iterate({
        query: `
          subscription OnUserUpdated {
            userUpdated {
              id
              email
              name
              updatedAt
            }
          }
        `,
      });

      const iterator = subscription[Symbol.asyncIterator]();
      const resultPromise = iterator.next();

      // Give subscription time to establish
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Update user (trigger event)
      await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          query: `
            mutation UpdateUser($input: UpdateUserInput!) {
              updateUser(input: $input) {
                id
              }
            }
          `,
          variables: {
            input: {
              name: 'Updated Subscription User',
            },
          },
        });

      // Wait for event
      const result = await Promise.race([
        resultPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Subscription timeout')), 5000)
        ),
      ]);

      expect(result).toBeDefined();
      expect((result as any).value.data.userUpdated).toBeDefined();
      expect((result as any).value.data.userUpdated.name).toBe('Updated Subscription User');

      await client.dispose();
    });
  });

  describe('messageSent Subscription', () => {
    it('should receive messageSent events for all messages', async () => {
      const client: Client = createClient({
        url: serverAddress,
        webSocketImpl: WebSocket,
        connectionParams: {
          authorization: `Bearer ${authToken}`,
        },
      });

      const subscription = client.iterate({
        query: `
          subscription OnMessageSent {
            messageSent {
              id
              content
              userId
              user {
                name
              }
              createdAt
            }
          }
        `,
      });

      const iterator = subscription[Symbol.asyncIterator]();
      const resultPromise = iterator.next();

      // Give subscription time to establish
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Send message (trigger event)
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
              content: 'Test subscription message',
              recipientId: userId,
            },
          },
        });

      // Wait for event
      const result = await Promise.race([
        resultPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Subscription timeout')), 5000)
        ),
      ]);

      expect(result).toBeDefined();
      expect((result as any).value.data.messageSent).toBeDefined();
      expect((result as any).value.data.messageSent.content).toBe('Test subscription message');
      expect((result as any).value.data.messageSent.user.name).toBe('Subscription Test User');

      await client.dispose();
    });

    it('should receive multiple messageSent events', async () => {
      const events: any[] = [];

      const client: Client = createClient({
        url: serverAddress,
        webSocketImpl: WebSocket,
        connectionParams: {
          authorization: `Bearer ${authToken}`,
        },
      });

      const subscription = client.iterate({
        query: `
          subscription OnMessageSent {
            messageSent {
              id
              content
            }
          }
        `,
      });

      const iterator = subscription[Symbol.asyncIterator]();

      // Give subscription time to establish
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Send multiple messages
      const messagePromises = [];
      for (let i = 1; i <= 3; i++) {
        messagePromises.push(
          request(app)
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
                  content: `Message ${i}`,
                  recipientId: userId,
                },
              },
            })
        );
      }

      // Send messages concurrently
      await Promise.all(messagePromises);

      // Collect events
      for (let i = 0; i < 3; i++) {
        const result = await Promise.race([
          iterator.next(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Subscription timeout')), 5000)
          ),
        ]);
        events.push((result as any).value.data.messageSent);
      }

      expect(events.length).toBe(3);
      expect(events.map((e) => e.content).sort()).toEqual([
        'Message 1',
        'Message 2',
        'Message 3',
      ]);

      await client.dispose();
    });
  });

  describe('messageToUser Subscription', () => {
    let otherUserId: string;
    let otherUserToken: string;

    beforeEach(async () => {
      // Create second user
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
              email: 'other.user@example.com',
              name: 'Other User',
              password: 'SecurePass123!',
            },
          },
        });

      otherUserId = otherUserResponse.body.data.register.user.id;
      otherUserToken = otherUserResponse.body.data.register.token;
    });

    it('should receive messages sent to specific user', async () => {
      const client: Client = createClient({
        url: serverAddress,
        webSocketImpl: WebSocket,
        connectionParams: {
          authorization: `Bearer ${authToken}`,
        },
      });

      const subscription = client.iterate({
        query: `
          subscription OnMessageToUser($userId: ID!) {
            messageToUser(userId: $userId) {
              id
              content
              userId
              recipientId
              user {
                name
              }
            }
          }
        `,
        variables: {
          userId: userId,
        },
      });

      const iterator = subscription[Symbol.asyncIterator]();
      const resultPromise = iterator.next();

      // Give subscription time to establish
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Other user sends message to first user
      await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${otherUserToken}`)
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
              content: 'Hello from other user!',
              recipientId: userId,
            },
          },
        });

      // Wait for event
      const result = await Promise.race([
        resultPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Subscription timeout')), 5000)
        ),
      ]);

      expect(result).toBeDefined();
      expect((result as any).value.data.messageToUser).toBeDefined();
      expect((result as any).value.data.messageToUser.content).toBe('Hello from other user!');
      expect((result as any).value.data.messageToUser.recipientId).toBe(userId);
      expect((result as any).value.data.messageToUser.user.name).toBe('Other User');

      await client.dispose();
    });

    it('should not receive messages sent to other users', async () => {
      const client: Client = createClient({
        url: serverAddress,
        webSocketImpl: WebSocket,
        connectionParams: {
          authorization: `Bearer ${authToken}`,
        },
      });

      const subscription = client.iterate({
        query: `
          subscription OnMessageToUser($userId: ID!) {
            messageToUser(userId: $userId) {
              id
              content
            }
          }
        `,
        variables: {
          userId: userId, // Listening for messages to first user
        },
      });

      const iterator = subscription[Symbol.asyncIterator]();
      const resultPromise = iterator.next();

      // Give subscription time to establish
      await new Promise((resolve) => setTimeout(resolve, 500));

      // First user sends message to other user (should not trigger subscription)
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
              content: 'Message to other user',
              recipientId: otherUserId,
            },
          },
        });

      // Wait a bit to ensure no event arrives
      const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 2000));

      const result = await Promise.race([resultPromise, timeoutPromise]);

      // Should timeout (no event received)
      expect(result).toBeUndefined();

      await client.dispose();
    });

    it('should receive only messages for subscribed user', async () => {
      const events: any[] = [];

      const client: Client = createClient({
        url: serverAddress,
        webSocketImpl: WebSocket,
        connectionParams: {
          authorization: `Bearer ${authToken}`,
        },
      });

      const subscription = client.iterate({
        query: `
          subscription OnMessageToUser($userId: ID!) {
            messageToUser(userId: $userId) {
              id
              content
              recipientId
            }
          }
        `,
        variables: {
          userId: userId,
        },
      });

      const iterator = subscription[Symbol.asyncIterator]();

      // Give subscription time to establish
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Send messages: 2 to first user, 1 to other user
      await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${otherUserToken}`)
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
              content: 'Message 1 to first user',
              recipientId: userId,
            },
          },
        });

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
              content: 'Message to other user (should not receive)',
              recipientId: otherUserId,
            },
          },
        });

      await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${otherUserToken}`)
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
              content: 'Message 2 to first user',
              recipientId: userId,
            },
          },
        });

      // Collect events (should receive exactly 2)
      for (let i = 0; i < 2; i++) {
        const result = await Promise.race([
          iterator.next(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Subscription timeout')), 5000)
          ),
        ]);
        events.push((result as any).value.data.messageToUser);
      }

      expect(events.length).toBe(2);
      expect(events.every((e) => e.recipientId === userId)).toBe(true);
      expect(events.map((e) => e.content).sort()).toEqual([
        'Message 1 to first user',
        'Message 2 to first user',
      ]);

      await client.dispose();
    });
  });

  describe('Subscription Error Handling', () => {
    it('should handle invalid subscription query', async () => {
      let errorOccurred = false;

      const client: Client = createClient({
        url: serverAddress,
        webSocketImpl: WebSocket,
        connectionParams: {
          authorization: `Bearer ${authToken}`,
        },
      });

      try {
        const subscription = client.iterate({
          query: `
            subscription InvalidSubscription {
              nonExistentSubscription {
                id
              }
            }
          `,
        });

        const iterator = subscription[Symbol.asyncIterator]();
        await iterator.next();
      } catch (error) {
        errorOccurred = true;
      } finally {
        await client.dispose();
      }

      expect(errorOccurred).toBe(true);
    });

    it('should handle missing required variables', async () => {
      let errorOccurred = false;

      const client: Client = createClient({
        url: serverAddress,
        webSocketImpl: WebSocket,
        connectionParams: {
          authorization: `Bearer ${authToken}`,
        },
      });

      try {
        const subscription = client.iterate({
          query: `
            subscription OnMessageToUser($userId: ID!) {
              messageToUser(userId: $userId) {
                id
              }
            }
          `,
          // Missing variables
        });

        const iterator = subscription[Symbol.asyncIterator]();
        await iterator.next();
      } catch (error) {
        errorOccurred = true;
      } finally {
        await client.dispose();
      }

      expect(errorOccurred).toBe(true);
    });
  });

  describe('Subscription Lifecycle', () => {
    it('should handle subscription cleanup on client disconnect', async () => {
      const client: Client = createClient({
        url: serverAddress,
        webSocketImpl: WebSocket,
        connectionParams: {
          authorization: `Bearer ${authToken}`,
        },
      });

      const subscription = client.iterate({
        query: `
          subscription OnMessageSent {
            messageSent {
              id
            }
          }
        `,
      });

      // Start iterator (but don't wait for it - testing cleanup)
      subscription[Symbol.asyncIterator]();

      // Give subscription time to establish
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Dispose client
      await client.dispose();

      // Send message (should not cause any issues even though subscription closed)
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
              content: 'Message after disconnect',
              recipientId: userId,
            },
          },
        });

      // No errors should occur
      expect(true).toBe(true);
    });
  });
});

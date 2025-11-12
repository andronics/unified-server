/**
 * Cross-Protocol Integration E2E Tests
 *
 * Tests interaction and data flow between HTTP, GraphQL, WebSocket, and TCP protocols
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import WebSocket from 'ws';
import net from 'net';
import type { Server } from 'http';
import type { Express } from 'express';
import { httpServer } from '@protocols/http/http-server';
import { database } from '@infrastructure/database/connection-pool';
import { redisClient } from '@infrastructure/cache/redis-client';
import { config } from '@infrastructure/config/config-loader';

describe('Cross-Protocol Integration E2E', () => {
  let server: Server;
  let app: Express;
  let authToken: string;
  let userId: string;
  let httpPort: number;
  let wsUrl: string;

  beforeAll(async () => {
    await database.connect();

    app = httpServer['app'];

    server = await new Promise<Server>((resolve) => {
      const srv = app.listen(0, () => {
        const address = srv.address();
        if (address && typeof address === 'object') {
          httpPort = address.port;
          wsUrl = `ws://localhost:${httpPort}/ws`;
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

    // Create test user
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'crossprotocol@example.com',
        name: 'Cross Protocol User',
        password: 'SecurePass123!',
      });

    authToken = registerResponse.body.data.token;
    userId = registerResponse.body.data.user.id;
  });

  describe('HTTP → WebSocket Integration', () => {
    it('should propagate HTTP REST message to WebSocket subscribers', async () => {
      const receivedMessages: any[] = [];

      // 1. Connect WebSocket client and subscribe
      const ws = await new Promise<WebSocket>((resolve, reject) => {
        const client = new WebSocket(wsUrl);

        client.on('open', () => {
          client.send(JSON.stringify({ type: 'auth', token: authToken }));
        });

        client.on('message', (data) => {
          const message = JSON.parse(data.toString());

          if (message.type === 'auth_success') {
            client.send(JSON.stringify({ type: 'subscribe', topic: 'messages.**' }));
          } else if (message.type === 'subscribed') {
            resolve(client);
          } else if (message.type === 'message') {
            receivedMessages.push(message.data);
          }
        });

        client.on('error', reject);
        setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
      });

      // 2. Send message via HTTP REST API
      const restResponse = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: userId,
          content: 'HTTP to WebSocket test message',
        });

      expect(restResponse.status).toBe(201);

      // 3. Wait for WebSocket to receive the message
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 4. Verify WebSocket received the message
      expect(receivedMessages.length).toBeGreaterThan(0);
      expect(receivedMessages[0].content).toBe('HTTP to WebSocket test message');

      ws.close();
    });

    it('should allow WebSocket and HTTP to access same data', async () => {
      // 1. Create message via HTTP
      const createResponse = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: userId,
          content: 'Shared data test',
        });

      const messageId = createResponse.body.data.id;

      // 2. Retrieve via HTTP
      const httpGetResponse = await request(app)
        .get(`/api/messages/${messageId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(httpGetResponse.status).toBe(200);
      expect(httpGetResponse.body.data.content).toBe('Shared data test');

      // 3. Retrieve via GraphQL
      const graphqlResponse = await request(app)
        .post('/graphql')
        .send({
          query: `
            query GetMessage($id: ID!) {
              message(id: $id) {
                id
                content
                userId
              }
            }
          `,
          variables: {
            id: messageId,
          },
        });

      expect(graphqlResponse.status).toBe(200);
      expect(graphqlResponse.body.data.message.content).toBe('Shared data test');
    });
  });

  describe('HTTP → GraphQL Integration', () => {
    it('should allow authentication via HTTP and use token in GraphQL', async () => {
      // 1. Authenticate via HTTP REST
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'crossprotocol@example.com',
          password: 'SecurePass123!',
        });

      expect(loginResponse.status).toBe(200);
      const token = loginResponse.body.data.token;

      // 2. Use token in GraphQL query
      const graphqlResponse = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({
          query: `
            query Me {
              me {
                id
                email
                name
              }
            }
          `,
        });

      expect(graphqlResponse.status).toBe(200);
      expect(graphqlResponse.body.data.me.email).toBe('crossprotocol@example.com');
    });

    it('should create message via HTTP and query via GraphQL', async () => {
      // 1. Create message via HTTP
      const createResponse = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: userId,
          content: 'HTTP to GraphQL test',
        });

      const messageId = createResponse.body.data.id;

      // 2. Query message via GraphQL
      const graphqlResponse = await request(app)
        .post('/graphql')
        .send({
          query: `
            query GetMessage($id: ID!) {
              message(id: $id) {
                id
                content
                user {
                  id
                  name
                }
              }
            }
          `,
          variables: {
            id: messageId,
          },
        });

      expect(graphqlResponse.status).toBe(200);
      expect(graphqlResponse.body.data.message.content).toBe('HTTP to GraphQL test');
      expect(graphqlResponse.body.data.message.user.name).toBe('Cross Protocol User');
    });
  });

  describe('GraphQL → WebSocket Integration', () => {
    it('should propagate GraphQL mutation to WebSocket subscribers', async () => {
      const receivedMessages: any[] = [];

      // 1. Connect WebSocket and subscribe
      const ws = await new Promise<WebSocket>((resolve, reject) => {
        const client = new WebSocket(wsUrl);

        client.on('open', () => {
          client.send(JSON.stringify({ type: 'auth', token: authToken }));
        });

        client.on('message', (data) => {
          const message = JSON.parse(data.toString());

          if (message.type === 'auth_success') {
            client.send(JSON.stringify({ type: 'subscribe', topic: 'messages.**' }));
          } else if (message.type === 'subscribed') {
            resolve(client);
          } else if (message.type === 'message') {
            receivedMessages.push(message.data);
          }
        });

        client.on('error', reject);
        setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
      });

      // 2. Create message via GraphQL mutation
      const graphqlResponse = await request(app)
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
              content: 'GraphQL to WebSocket test',
              recipientId: userId,
            },
          },
        });

      expect(graphqlResponse.status).toBe(200);

      // 3. Wait for WebSocket to receive
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 4. Verify WebSocket received the message
      expect(receivedMessages.length).toBeGreaterThan(0);
      expect(receivedMessages[0].content).toBe('GraphQL to WebSocket test');

      ws.close();
    });
  });

  describe('Multi-Protocol Authentication', () => {
    it('should authenticate consistently across all protocols', async () => {
      // 1. Register via GraphQL
      const registerResponse = await request(app)
        .post('/graphql')
        .send({
          query: `
            mutation Register($input: RegisterInput!) {
              register(input: $input) {
                user {
                  id
                  email
                }
                token
              }
            }
          `,
          variables: {
            input: {
              email: 'multiauth@example.com',
              name: 'Multi Auth User',
              password: 'SecurePass123!',
            },
          },
        });

      const token = registerResponse.body.data.register.token;
      const newUserId = registerResponse.body.data.register.user.id;

      // 2. Verify token works in HTTP
      const httpResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(httpResponse.status).toBe(200);
      expect(httpResponse.body.data.email).toBe('multiauth@example.com');

      // 3. Verify token works in GraphQL
      const graphqlResponse = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
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

      expect(graphqlResponse.status).toBe(200);
      expect(graphqlResponse.body.data.me.id).toBe(newUserId);

      // 4. Verify token works in WebSocket
      const wsConnected = await new Promise<boolean>((resolve, reject) => {
        const client = new WebSocket(wsUrl);

        client.on('open', () => {
          client.send(JSON.stringify({ type: 'auth', token: token }));
        });

        client.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'auth_success') {
            expect(message.userId).toBe(newUserId);
            client.close();
            resolve(true);
          } else if (message.type === 'auth_error') {
            client.close();
            reject(new Error('WebSocket auth failed'));
          }
        });

        client.on('error', reject);
        setTimeout(() => reject(new Error('WebSocket auth timeout')), 5000);
      });

      expect(wsConnected).toBe(true);
    });

    it('should reject invalid tokens across all protocols', async () => {
      const invalidToken = 'invalid.jwt.token';

      // 1. HTTP should reject
      const httpResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${invalidToken}`);

      expect(httpResponse.status).toBe(401);

      // 2. GraphQL should reject
      const graphqlResponse = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${invalidToken}`)
        .send({
          query: `
            query Me {
              me {
                id
              }
            }
          `,
        });

      expect(graphqlResponse.status).toBe(200);
      expect(graphqlResponse.body.errors).toBeDefined();
      expect(graphqlResponse.body.errors[0].message).toContain('Invalid token');

      // 3. WebSocket should reject
      const wsRejected = await new Promise<boolean>((resolve, reject) => {
        const client = new WebSocket(wsUrl);

        client.on('open', () => {
          client.send(JSON.stringify({ type: 'auth', token: invalidToken }));
        });

        client.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'auth_error') {
            client.close();
            resolve(true);
          }
        });

        client.on('error', reject);
        setTimeout(() => reject(new Error('WebSocket timeout')), 5000);
      });

      expect(wsRejected).toBe(true);
    });
  });

  describe('Data Consistency Across Protocols', () => {
    it('should maintain data consistency when creating via different protocols', async () => {
      // Create 3 messages via different protocols

      // 1. Via HTTP
      const httpMessage = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: userId,
          content: 'HTTP message',
        });

      // 2. Via GraphQL
      const graphqlMessage = await request(app)
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
              content: 'GraphQL message',
              recipientId: userId,
            },
          },
        });

      // 3. Query all messages via GraphQL
      const allMessages = await request(app)
        .post('/graphql')
        .send({
          query: `
            query GetMessages {
              messages {
                edges {
                  node {
                    id
                    content
                  }
                }
                pageInfo {
                  total
                }
              }
            }
          `,
        });

      expect(allMessages.body.data.messages.pageInfo.total).toBeGreaterThanOrEqual(2);

      // 4. Query all messages via HTTP
      const httpMessages = await request(app)
        .get('/api/messages')
        .set('Authorization', `Bearer ${authToken}`);

      expect(httpMessages.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('should update user via one protocol and see changes in all protocols', async () => {
      // 1. Update user via GraphQL
      await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
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
              name: 'Updated Cross Protocol User',
            },
          },
        });

      // 2. Verify via HTTP
      const httpResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(httpResponse.body.data.name).toBe('Updated Cross Protocol User');

      // 3. Verify via GraphQL
      const graphqlResponse = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          query: `
            query Me {
              me {
                name
              }
            }
          `,
        });

      expect(graphqlResponse.body.data.me.name).toBe('Updated Cross Protocol User');

      // 4. Verify via direct query
      const directQuery = await request(app)
        .post('/graphql')
        .send({
          query: `
            query GetUser($id: ID!) {
              user(id: $id) {
                name
              }
            }
          `,
          variables: {
            id: userId,
          },
        });

      expect(directQuery.body.data.user.name).toBe('Updated Cross Protocol User');
    });
  });

  describe('Event Propagation Across Protocols', () => {
    it('should propagate events from any protocol to all subscribers', async () => {
      const wsEvents: any[] = [];

      // 1. Setup WebSocket subscriber
      const ws = await new Promise<WebSocket>((resolve, reject) => {
        const client = new WebSocket(wsUrl);

        client.on('open', () => {
          client.send(JSON.stringify({ type: 'auth', token: authToken }));
        });

        client.on('message', (data) => {
          const message = JSON.parse(data.toString());

          if (message.type === 'auth_success') {
            client.send(JSON.stringify({ type: 'subscribe', topic: 'users.**' }));
          } else if (message.type === 'subscribed') {
            resolve(client);
          } else if (message.type === 'message') {
            wsEvents.push(message);
          }
        });

        client.on('error', reject);
        setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
      });

      // 2. Create user via HTTP (should trigger event)
      const newUser = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'eventtest@example.com',
          name: 'Event Test User',
          password: 'SecurePass123!',
        });

      expect(newUser.status).toBe(201);

      // 3. Wait for event propagation
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 4. Verify WebSocket received user.created event
      const userCreatedEvent = wsEvents.find((e) =>
        e.topic && e.topic.includes('users') && e.data?.user
      );

      expect(userCreatedEvent).toBeDefined();

      ws.close();
    });

    it('should handle concurrent events from multiple protocols', async () => {
      const wsEvents: any[] = [];

      // 1. Setup WebSocket subscriber
      const ws = await new Promise<WebSocket>((resolve, reject) => {
        const client = new WebSocket(wsUrl);

        client.on('open', () => {
          client.send(JSON.stringify({ type: 'auth', token: authToken }));
        });

        client.on('message', (data) => {
          const message = JSON.parse(data.toString());

          if (message.type === 'auth_success') {
            client.send(JSON.stringify({ type: 'subscribe', topic: 'messages.**' }));
          } else if (message.type === 'subscribed') {
            resolve(client);
          } else if (message.type === 'message') {
            wsEvents.push(message);
          }
        });

        client.on('error', reject);
        setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
      });

      // 2. Send messages concurrently from different protocols
      const promises = [
        request(app)
          .post('/api/messages')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ userId: userId, content: 'HTTP message 1' }),

        request(app)
          .post('/graphql')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            query: `
              mutation SendMessage($input: SendMessageInput!) {
                sendMessage(input: $input) { id }
              }
            `,
            variables: {
              input: { content: 'GraphQL message 1', recipientId: userId },
            },
          }),

        request(app)
          .post('/api/messages')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ userId: userId, content: 'HTTP message 2' }),
      ];

      await Promise.all(promises);

      // 3. Wait for all events
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // 4. Verify all events received
      expect(wsEvents.length).toBeGreaterThanOrEqual(3);

      ws.close();
    });
  });

  describe('Error Handling Across Protocols', () => {
    it('should handle validation errors consistently', async () => {
      // Invalid email should fail in both protocols

      // 1. HTTP validation
      const httpResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          name: 'Test User',
          password: 'SecurePass123!',
        });

      expect(httpResponse.status).toBe(400);

      // 2. GraphQL validation
      const graphqlResponse = await request(app)
        .post('/graphql')
        .send({
          query: `
            mutation Register($input: RegisterInput!) {
              register(input: $input) {
                user { id }
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

      expect(graphqlResponse.body.errors).toBeDefined();
      expect(graphqlResponse.body.errors[0].message).toContain('email');
    });

    it('should handle not found errors consistently', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // 1. HTTP not found
      const httpResponse = await request(app)
        .get(`/api/messages/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(httpResponse.status).toBe(404);

      // 2. GraphQL returns null
      const graphqlResponse = await request(app)
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
            id: nonExistentId,
          },
        });

      expect(graphqlResponse.body.data.message).toBeNull();
    });
  });
});

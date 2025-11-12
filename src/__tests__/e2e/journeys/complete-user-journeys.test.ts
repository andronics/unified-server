/**
 * Complete User Journey E2E Tests
 *
 * Tests real-world user workflows from start to finish
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import WebSocket from 'ws';
import type { Server } from 'http';
import type { Express } from 'express';
import { httpServer } from '@protocols/http/http-server';
import { database } from '@infrastructure/database/connection-pool';
import { redisClient } from '@infrastructure/cache/redis-client';

describe('Complete User Journeys E2E', () => {
  let server: Server;
  let app: Express;
  let wsUrl: string;

  beforeAll(async () => {
    await database.connect();

    app = httpServer['app'];

    server = await new Promise<Server>((resolve) => {
      const srv = app.listen(0, () => {
        const address = srv.address();
        if (address && typeof address === 'object') {
          wsUrl = `ws://localhost:${address.port}/ws`;
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
  });

  describe('New User Onboarding Journey', () => {
    it('should complete full signup → profile setup → first message flow', async () => {
      // 1. User visits platform and registers
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@example.com',
          name: 'New User',
          password: 'SecurePass123!',
        });

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.data.token).toBeDefined();

      const token = registerResponse.body.data.token;
      const userId = registerResponse.body.data.user.id;

      // 2. User verifies their profile
      const profileResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(profileResponse.status).toBe(200);
      expect(profileResponse.body.data.email).toBe('newuser@example.com');

      // 3. User updates their profile
      const updateResponse = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
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
              name: 'New User (Updated)',
            },
          },
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.data.updateUser.name).toBe('New User (Updated)');

      // 4. User connects to WebSocket
      const ws = await new Promise<WebSocket>((resolve, reject) => {
        const client = new WebSocket(wsUrl);

        client.on('open', () => {
          client.send(JSON.stringify({ type: 'auth', token }));
        });

        client.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'auth_success') {
            resolve(client);
          }
        });

        client.on('error', reject);
        setTimeout(() => reject(new Error('WebSocket timeout')), 5000);
      });

      expect(ws.readyState).toBe(WebSocket.OPEN);

      // 5. User sends their first message
      const messageResponse = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${token}`)
        .send({
          userId: userId,
          content: 'My first message!',
        });

      expect(messageResponse.status).toBe(201);
      expect(messageResponse.body.data.content).toBe('My first message!');

      // 6. User queries their messages
      const messagesResponse = await request(app)
        .get('/api/messages')
        .set('Authorization', `Bearer ${token}`);

      expect(messagesResponse.status).toBe(200);
      expect(messagesResponse.body.data.length).toBeGreaterThan(0);

      ws.close();
    });
  });

  describe('Multi-Device User Journey', () => {
    it('should allow user to login on multiple devices and sync data', async () => {
      // 1. User registers on Device 1
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'multidevice@example.com',
          name: 'Multi Device User',
          password: 'SecurePass123!',
        });

      const userId = registerResponse.body.data.user.id;
      const device1Token = registerResponse.body.data.token;

      // 2. User creates a message on Device 1
      await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${device1Token}`)
        .send({
          userId: userId,
          content: 'Message from Device 1',
        });

      // 3. User logs in on Device 2
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'multidevice@example.com',
          password: 'SecurePass123!',
        });

      expect(loginResponse.status).toBe(200);
      const device2Token = loginResponse.body.data.token;

      // 4. User sees their message on Device 2
      const messagesOnDevice2 = await request(app)
        .get('/api/messages')
        .set('Authorization', `Bearer ${device2Token}`);

      expect(messagesOnDevice2.status).toBe(200);
      const messageFromDevice1 = messagesOnDevice2.body.data.find(
        (m: any) => m.content === 'Message from Device 1'
      );
      expect(messageFromDevice1).toBeDefined();

      // 5. User sends message from Device 2
      await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${device2Token}`)
        .send({
          userId: userId,
          content: 'Message from Device 2',
        });

      // 6. User sees both messages on Device 1
      const allMessagesOnDevice1 = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${device1Token}`)
        .send({
          query: `
            query GetMessages {
              messages {
                edges {
                  node {
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

      expect(allMessagesOnDevice1.body.data.messages.pageInfo.total).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Collaborative Messaging Journey', () => {
    it('should support real-time collaboration between users', async () => {
      // 1. Alice registers
      const aliceRegister = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'alice@example.com',
          name: 'Alice',
          password: 'SecurePass123!',
        });

      const aliceToken = aliceRegister.body.data.token;
      const aliceId = aliceRegister.body.data.user.id;

      // 2. Bob registers
      const bobRegister = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'bob@example.com',
          name: 'Bob',
          password: 'SecurePass123!',
        });

      const bobToken = bobRegister.body.data.token;
      const bobId = bobRegister.body.data.user.id;

      // 3. Alice connects to WebSocket and subscribes
      const aliceMessages: any[] = [];
      const aliceWs = await new Promise<WebSocket>((resolve, reject) => {
        const client = new WebSocket(wsUrl);

        client.on('open', () => {
          client.send(JSON.stringify({ type: 'auth', token: aliceToken }));
        });

        client.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'auth_success') {
            client.send(JSON.stringify({ type: 'subscribe', topic: `messages.user.${aliceId}` }));
          } else if (message.type === 'subscribed') {
            resolve(client);
          } else if (message.type === 'message') {
            aliceMessages.push(message.data);
          }
        });

        client.on('error', reject);
        setTimeout(() => reject(new Error('Alice WebSocket timeout')), 5000);
      });

      // 4. Bob sends message to Alice
      const bobToAlice = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${bobToken}`)
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
              content: 'Hi Alice, this is Bob!',
              recipientId: aliceId,
            },
          },
        });

      expect(bobToAlice.status).toBe(200);

      // 5. Wait for Alice to receive message
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 6. Verify Alice received message in real-time
      const receivedMessage = aliceMessages.find((m) => m.content === 'Hi Alice, this is Bob!');
      expect(receivedMessage).toBeDefined();

      // 7. Alice replies to Bob
      const aliceToBob = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          userId: aliceId,
          content: 'Hey Bob! Nice to hear from you!',
          recipientId: bobId,
        });

      expect(aliceToBob.status).toBe(201);

      // 8. Bob queries his messages and sees Alice's reply
      const bobMessages = await request(app)
        .post('/graphql')
        .send({
          query: `
            query GetUserMessages($userId: ID!) {
              userMessages(userId: $userId) {
                edges {
                  node {
                    content
                    user {
                      name
                    }
                  }
                }
              }
            }
          `,
          variables: {
            userId: bobId,
          },
        });

      const aliceReply = bobMessages.body.data.userMessages.edges.find(
        (e: any) => e.node.content === 'Hey Bob! Nice to hear from you!'
      );
      expect(aliceReply).toBeDefined();

      aliceWs.close();
    });
  });

  describe('Channel Communication Journey', () => {
    it('should support channel-based group messaging', async () => {
      // 1. Create three users
      const users = await Promise.all([
        request(app).post('/api/auth/register').send({
          email: 'user1@example.com',
          name: 'User 1',
          password: 'SecurePass123!',
        }),
        request(app).post('/api/auth/register').send({
          email: 'user2@example.com',
          name: 'User 2',
          password: 'SecurePass123!',
        }),
        request(app).post('/api/auth/register').send({
          email: 'user3@example.com',
          name: 'User 3',
          password: 'SecurePass123!',
        }),
      ]);

      const tokens = users.map((u) => u.body.data.token);

      // 2. All users connect to WebSocket and subscribe to channel
      const channelEvents: any[][] = [[], [], []];
      const wsConnections = await Promise.all(
        tokens.map(
          (token, index) =>
            new Promise<WebSocket>((resolve, reject) => {
              const client = new WebSocket(wsUrl);

              client.on('open', () => {
                client.send(JSON.stringify({ type: 'auth', token }));
              });

              client.on('message', (data) => {
                const message = JSON.parse(data.toString());
                if (message.type === 'auth_success') {
                  client.send(
                    JSON.stringify({ type: 'subscribe', topic: 'messages.channel.general' })
                  );
                } else if (message.type === 'subscribed') {
                  resolve(client);
                } else if (message.type === 'message') {
                  channelEvents[index].push(message.data);
                }
              });

              client.on('error', reject);
              setTimeout(() => reject(new Error(`User ${index + 1} WebSocket timeout`)), 5000);
            })
        )
      );

      // 3. User 1 sends message to channel
      await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${tokens[0]}`)
        .send({
          userId: users[0].body.data.user.id,
          content: 'Hello everyone in the channel!',
          channelId: 'general',
        });

      // 4. Wait for propagation
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 5. Verify all users received the message
      for (let i = 0; i < 3; i++) {
        const received = channelEvents[i].find((m) => m.content === 'Hello everyone in the channel!');
        expect(received).toBeDefined();
      }

      // 6. Multiple users respond
      await Promise.all([
        request(app)
          .post('/graphql')
          .set('Authorization', `Bearer ${tokens[1]}`)
          .send({
            query: `
              mutation SendMessage($input: SendMessageInput!) {
                sendMessage(input: $input) { id }
              }
            `,
            variables: {
              input: {
                content: 'User 2 here!',
                channelId: 'general',
              },
            },
          }),
        request(app)
          .post('/graphql')
          .set('Authorization', `Bearer ${tokens[2]}`)
          .send({
            query: `
              mutation SendMessage($input: SendMessageInput!) {
                sendMessage(input: $input) { id }
              }
            `,
            variables: {
              input: {
                content: 'User 3 joining the conversation!',
                channelId: 'general',
              },
            },
          }),
      ]);

      // 7. Wait for all messages
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 8. Verify all users received all messages
      for (let i = 0; i < 3; i++) {
        expect(channelEvents[i].length).toBeGreaterThanOrEqual(3);
      }

      // 9. Query channel messages via GraphQL
      const channelMessages = await request(app)
        .post('/graphql')
        .send({
          query: `
            query GetChannelMessages($channelId: ID!) {
              channelMessages(channelId: $channelId) {
                edges {
                  node {
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
            channelId: 'general',
          },
        });

      expect(channelMessages.body.data.channelMessages.pageInfo.total).toBeGreaterThanOrEqual(3);

      wsConnections.forEach((ws) => ws.close());
    });
  });

  describe('Profile Management Journey', () => {
    it('should support complete profile lifecycle', async () => {
      // 1. User registers
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
              email: 'profileuser@example.com',
              name: 'Profile User',
              password: 'SecurePass123!',
            },
          },
        });

      const token = registerResponse.body.data.register.token;
      const userId = registerResponse.body.data.register.user.id;

      // 2. User views their profile
      const viewProfile = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({
          query: `
            query Me {
              me {
                id
                email
                name
                createdAt
              }
            }
          `,
        });

      expect(viewProfile.body.data.me.name).toBe('Profile User');

      // 3. User updates their name
      await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({
          query: `
            mutation UpdateUser($input: UpdateUserInput!) {
              updateUser(input: $input) {
                name
              }
            }
          `,
          variables: {
            input: {
              name: 'Updated Profile User',
            },
          },
        });

      // 4. User updates their email
      await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({
          query: `
            mutation UpdateUser($input: UpdateUserInput!) {
              updateUser(input: $input) {
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

      // 5. User verifies both updates
      const updatedProfile = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(updatedProfile.body.data.name).toBe('Updated Profile User');
      expect(updatedProfile.body.data.email).toBe('newemail@example.com');

      // 6. User sends messages
      await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${token}`)
        .send({
          userId: userId,
          content: 'Message 1',
        });

      await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${token}`)
        .send({
          userId: userId,
          content: 'Message 2',
        });

      // 7. User views their activity
      const userMessages = await request(app)
        .post('/graphql')
        .send({
          query: `
            query GetUserMessages($userId: ID!) {
              userMessages(userId: $userId) {
                edges {
                  node {
                    content
                    user {
                      name
                    }
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

      expect(userMessages.body.data.userMessages.pageInfo.total).toBeGreaterThanOrEqual(2);

      // 8. User decides to delete account
      const deleteResponse = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({
          query: `
            mutation DeleteUser {
              deleteUser
            }
          `,
        });

      expect(deleteResponse.body.data.deleteUser).toBe(true);

      // 9. Verify account is deleted
      const checkDeleted = await request(app)
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

      expect(checkDeleted.body.data.user).toBeNull();

      // 10. Verify deleted user cannot login
      const attemptLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'newemail@example.com',
          password: 'SecurePass123!',
        });

      expect(attemptLogin.status).toBe(404);
    });
  });

  describe('Error Recovery Journey', () => {
    it('should gracefully handle and recover from errors', async () => {
      // 1. User attempts registration with invalid data
      const invalidRegister = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          name: '',
          password: '123',
        });

      expect(invalidRegister.status).toBe(400);

      // 2. User corrects and successfully registers
      const validRegister = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'recovery@example.com',
          name: 'Recovery User',
          password: 'SecurePass123!',
        });

      expect(validRegister.status).toBe(201);
      const token = validRegister.body.data.token;
      const userId = validRegister.body.data.user.id;

      // 3. User attempts login with wrong password
      const wrongPassword = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'recovery@example.com',
          password: 'WrongPassword123!',
        });

      expect(wrongPassword.status).toBe(401);

      // 4. User successfully logs in with correct password
      const correctLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'recovery@example.com',
          password: 'SecurePass123!',
        });

      expect(correctLogin.status).toBe(200);

      // 5. User attempts to send invalid message
      const invalidMessage = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${token}`)
        .send({
          userId: userId,
          content: '', // Empty content
        });

      expect(invalidMessage.status).toBe(400);

      // 6. User sends valid message
      const validMessage = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${token}`)
        .send({
          userId: userId,
          content: 'Valid message after error',
        });

      expect(validMessage.status).toBe(201);

      // 7. User attempts to access non-existent resource
      const notFound = await request(app)
        .get('/api/messages/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`);

      expect(notFound.status).toBe(404);

      // 8. User successfully queries existing messages
      const existingMessages = await request(app)
        .get('/api/messages')
        .set('Authorization', `Bearer ${token}`);

      expect(existingMessages.status).toBe(200);
      expect(existingMessages.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('Session Management Journey', () => {
    it('should handle session lifecycle correctly', async () => {
      // 1. User registers and gets initial session
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'session@example.com',
          name: 'Session User',
          password: 'SecurePass123!',
        });

      const initialToken = registerResponse.body.data.token;
      const userId = registerResponse.body.data.user.id;

      // 2. User uses session to access protected resource
      const protectedAccess1 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${initialToken}`);

      expect(protectedAccess1.status).toBe(200);

      // 3. User logs out (implicit - just stops using token)
      // In production, you might have a logout endpoint that invalidates tokens

      // 4. User logs in again (new session)
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'session@example.com',
          password: 'SecurePass123!',
        });

      const newToken = loginResponse.body.data.token;
      expect(newToken).toBeDefined();

      // 5. Both tokens should work (stateless JWT)
      const accessWithOldToken = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${initialToken}`);

      const accessWithNewToken = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${newToken}`);

      expect(accessWithOldToken.status).toBe(200);
      expect(accessWithNewToken.status).toBe(200);

      // 6. User updates profile with one token
      await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${newToken}`)
        .send({
          query: `
            mutation UpdateUser($input: UpdateUserInput!) {
              updateUser(input: $input) {
                name
              }
            }
          `,
          variables: {
            input: {
              name: 'Updated Session User',
            },
          },
        });

      // 7. Change is visible with both tokens
      const checkWithOldToken = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${initialToken}`);

      const checkWithNewToken = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${newToken}`);

      expect(checkWithOldToken.body.data.name).toBe('Updated Session User');
      expect(checkWithNewToken.body.data.name).toBe('Updated Session User');
    });
  });
});

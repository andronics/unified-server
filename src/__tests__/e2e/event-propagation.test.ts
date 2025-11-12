/**
 * End-to-End Event Propagation Tests
 *
 * Tests event flow from HTTP operations through EventBus, PubSub, to WebSocket clients
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import WebSocket from 'ws';
import type { Server } from 'http';
import type { Express } from 'express';
import { httpServer } from '@protocols/http/http-server';
import { connectionManager } from '@protocols/websocket/connection-manager';
import { initializeMessageHandler, initializeWebSocketServer, initializeEventBridge } from '@protocols/websocket';
import { pubSubBroker } from '@infrastructure/pubsub/pubsub-broker';
import { eventBus } from '@infrastructure/events/event-bus';
import { database } from '@infrastructure/database/connection-pool';
import { redisClient } from '@infrastructure/cache/redis-client';

describe('E2E Event Propagation Tests', () => {
  let server: Server;
  let app: Express;
  let wsUrl: string;
  let websocketServer: any;
  let eventBridge: any;

  beforeAll(async () => {
    await database.connect();
    await pubSubBroker.connect();

    app = httpServer['app'];

    server = await new Promise<Server>((resolve) => {
      const srv = app.listen(0, () => resolve(srv));
    });

    const address = server.address();
    const port = typeof address === 'object' && address !== null ? address.port : 3000;

    const messageHandler = initializeMessageHandler(connectionManager);
    websocketServer = initializeWebSocketServer(connectionManager, messageHandler);
    await websocketServer.start(server);

    eventBridge = initializeEventBridge(eventBus, pubSubBroker);
    await eventBridge.start();

    wsUrl = `ws://localhost:${port}/ws`;
  });

  afterAll(async () => {
    await connectionManager.closeAll();
    if (websocketServer) await websocketServer.stop();
    if (eventBridge) await eventBridge.stop();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pubSubBroker.disconnect();
    await database.disconnect();
    await redisClient.disconnect();
  });

  beforeEach(async () => {
    // Close all existing WebSocket connections to ensure test isolation
    await connectionManager.closeAll();
    await database.query('DELETE FROM messages');
    await database.query('DELETE FROM users');
  });

  describe('EventBus → PubSub → WebSocket Flow', () => {
    it('should propagate user.created event through all layers', async () => {
      // Setup: Admin user listening for user events
      const admin = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'admin.events@example.com',
          name: 'Admin',
          password: 'SecurePass123!',
        });

      // Login admin to get token
      const adminLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin.events@example.com',
          password: 'SecurePass123!',
        });
      const adminToken = adminLogin.body.data.token;

      const receivedEvents: any[] = [];
      const adminWs = await connectAndSubscribe(adminToken, 'users.**', receivedEvents);

      // Track EventBus emissions
      const eventBusEmissions: any[] = [];
      const eventHandler = (event: any) => {
        eventBusEmissions.push(event);
      };
      eventBus.on('user.created', eventHandler);

      // Create new user (triggers event)
      const newUserResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser.events@example.com',
          name: 'New User',
          password: 'SecurePass123!',
        });

      expect(newUserResponse.status).toBe(201);
      const newUserId = newUserResponse.body.data.id;

      // Wait for event propagation
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify EventBus emission
      const busEvent = eventBusEmissions.find(e =>
        e.data && e.data.user && e.data.user.id === newUserId
      );
      expect(busEvent).toBeDefined();
      expect(busEvent.eventType).toBe('user.created');

      // Verify WebSocket reception
      const wsEvent = receivedEvents.find(e =>
        e.data && e.data.user && e.data.user.id === newUserId
      );
      expect(wsEvent).toBeDefined();
      expect(wsEvent.topic).toBe('users');

      // Cleanup
      eventBus.off('user.created', eventHandler);
      adminWs.close();
    });

    it('should propagate message.sent event with correct routing', async () => {
      // Setup: Two users
      const [user1, user2] = await Promise.all([
        request(app).post('/api/auth/register').send({
          email: 'sender@example.com',
          name: 'Sender',
          password: 'SecurePass123!',
        }),
        request(app).post('/api/auth/register').send({
          email: 'receiver@example.com',
          name: 'Receiver',
          password: 'SecurePass123!',
        }),
      ]);

      // Login both users to get tokens
      const [login1, login2] = await Promise.all([
        request(app).post('/api/auth/login').send({
          email: 'sender@example.com',
          password: 'SecurePass123!',
        }),
        request(app).post('/api/auth/login').send({
          email: 'receiver@example.com',
          password: 'SecurePass123!',
        }),
      ]);

      const token1 = login1.body.data.token;
      const token2 = login2.body.data.token;
      const user2Id = user2.body.data.id;

      // User 2 listens for messages
      const user2Events: any[] = [];
      const ws2 = await connectAndSubscribe(token2, `messages.user.${user2Id}`, user2Events);

      // User 1 listens for all messages (wildcard)
      const user1Events: any[] = [];
      const ws1 = await connectAndSubscribe(token1, 'messages.**', user1Events);

      // Track EventBus
      const messageSentEvents: any[] = [];
      const messageHandler = (event: any) => {
        messageSentEvents.push(event);
      };
      eventBus.on('message.sent', messageHandler);

      // Send message from User 1 to User 2
      const messageResponse = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          content: 'Test event propagation',
          recipientId: user2Id,
        });

      expect(messageResponse.status).toBe(201);
      const messageId = messageResponse.body.data.id;

      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify EventBus
      const busEvent = messageSentEvents.find(e =>
        e.data && e.data.message && e.data.message.id === messageId
      );
      expect(busEvent).toBeDefined();
      expect(busEvent.eventType).toBe('message.sent');

      // Verify User 2 received via WebSocket (specific topic)
      const user2Event = user2Events.find(e =>
        e.data && e.data.message && e.data.message.id === messageId
      );
      expect(user2Event).toBeDefined();
      expect(user2Event.topic).toBe(`messages.user.${user2Id}`);

      // Verify User 1 also received (wildcard subscription)
      const user1Event = user1Events.find(e =>
        e.data && e.data.message && e.data.message.id === messageId
      );
      expect(user1Event).toBeDefined();

      // Cleanup
      eventBus.off('message.sent', messageHandler);
      ws1.close();
      ws2.close();
    });

    it('should handle channel messages with multiple subscribers', async () => {
      const channelId = 'test-channel-e2e';

      // Create 3 users
      const users = await Promise.all([
        request(app).post('/api/auth/register').send({
          email: 'channel1@example.com',
          name: 'Channel User',
          password: 'SecurePass123!',
        }),
        request(app).post('/api/auth/register').send({
          email: 'channel2@example.com',
          name: 'Channel User',
          password: 'SecurePass123!',
        }),
        request(app).post('/api/auth/register').send({
          email: 'channel3@example.com',
          name: 'Channel User',
          password: 'SecurePass123!',
        }),
      ]);

      // Login all users to get tokens
      const logins = await Promise.all([
        request(app).post('/api/auth/login').send({
          email: 'channel1@example.com',
          password: 'SecurePass123!',
        }),
        request(app).post('/api/auth/login').send({
          email: 'channel2@example.com',
          password: 'SecurePass123!',
        }),
        request(app).post('/api/auth/login').send({
          email: 'channel3@example.com',
          password: 'SecurePass123!',
        }),
      ]);
      const tokens = logins.map(l => l.body.data.token);

      // All users subscribe to channel
      const userEvents: any[][] = [[], [], []];
      const connections = await Promise.all(
        tokens.map((token, idx) =>
          connectAndSubscribe(token, `messages.channel.${channelId}`, userEvents[idx])
        )
      );

      // User 1 sends message to channel
      const messageResponse = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${tokens[0]}`)
        .send({
          content: 'Channel broadcast message',
          channelId: channelId,
        });

      expect(messageResponse.status).toBe(201);

      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 1000));

      // All users should receive the message
      userEvents.forEach((events, idx) => {
        const received = events.find(e =>
          e.data &&
          e.data.message &&
          e.data.message.content === 'Channel broadcast message'
        );
        expect(received).toBeDefined();
        expect(received.topic).toBe(`messages.channel.${channelId}`);
      });

      // Cleanup
      connections.forEach(ws => ws.close());
    });
  });

  describe('Cross-Protocol State Synchronization', () => {
    it('should maintain consistency between HTTP and WebSocket views', async () => {
      // Create user
      const user = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'sync@example.com',
          name: 'Sync User',
          password: 'SecurePass123!',
        });

      // Login to get token
      const login = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'sync@example.com',
          password: 'SecurePass123!',
        });
      const token = login.body.data.token;
      const userId = user.body.data.id;

      // Connect WebSocket and track all events
      const allEvents: any[] = [];
      const ws = await connectAndSubscribe(token, '**', allEvents); // Subscribe to everything

      // Perform HTTP operations
      // 1. Update user profile
      await request(app)
        .put(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Sync User' })
        .expect(200);

      // 2. Send a message
      const messageRes = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${token}`)
        .send({
          content: 'Self message',
          recipientId: userId,
        })
        .expect(201);

      const messageId = messageRes.body.data.id;

      // Wait for events
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify user update event
      const userUpdateEvent = allEvents.find(e =>
        e.topic && e.topic.includes('users') &&
        e.data && e.data.user && e.data.user.name === 'Updated Sync User'
      );
      expect(userUpdateEvent).toBeDefined();

      // Verify message event
      const messageEvent = allEvents.find(e =>
        e.topic && e.topic.includes('messages') &&
        e.data && e.data.message && e.data.message.id === messageId
      );
      expect(messageEvent).toBeDefined();

      // Verify HTTP state matches WebSocket events
      const userGetResponse = await request(app)
        .get(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(userGetResponse.body.data.name).toBe('Updated Sync User');

      ws.close();
    });
  });

  describe('Event Ordering and Consistency', () => {
    it('should maintain event order during rapid operations', async () => {
      const user = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'ordering@example.com',
          name: 'Order User',
          password: 'SecurePass123!',
        });

      // Login to get token
      const login = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'ordering@example.com',
          password: 'SecurePass123!',
        });
      const token = login.body.data.token;
      const userId = user.body.data.id;

      const events: any[] = [];
      const ws = await connectAndSubscribe(token, `messages.user.${userId}`, events);

      // Send multiple messages rapidly
      const messageCount = 10;
      const messageIds: string[] = [];

      for (let i = 0; i < messageCount; i++) {
        const res = await request(app)
          .post('/api/messages')
          .set('Authorization', `Bearer ${token}`)
          .send({
            content: `Message ${i}`,
            recipientId: userId,
          });
        messageIds.push(res.body.data.id);
      }

      // Wait for all events
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify all messages received
      messageIds.forEach((id, index) => {
        const event = events.find(e =>
          e.data && e.data.message && e.data.message.id === id
        );
        expect(event).toBeDefined();
        expect(event.data.message.content).toBe(`Message ${index}`);
      });

      // Events should be in order (check content sequence)
      const receivedMessages = events
        .filter(e => e.data && e.data.message)
        .map(e => e.data.message.content);

      // Ensure we received all messages
      expect(receivedMessages.length).toBe(messageCount);

      // Check ordering (Message 0, Message 1, Message 2, etc.)
      for (let i = 0; i < receivedMessages.length - 1; i++) {
        const currentParts = receivedMessages[i].split(' ');
        const nextParts = receivedMessages[i + 1].split(' ');

        expect(currentParts.length).toBe(2); // "Message" "N"
        expect(nextParts.length).toBe(2);

        const current = parseInt(currentParts[1], 10);
        const next = parseInt(nextParts[1], 10);

        expect(Number.isNaN(current)).toBe(false);
        expect(Number.isNaN(next)).toBe(false);
        expect(next).toBeGreaterThan(current);
      }

      ws.close();
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle and recover from event processing errors', async () => {
      const user = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'error.recovery@example.com',
          name: 'Error User',
          password: 'SecurePass123!',
        });

      // Login to get token
      const login = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'error.recovery@example.com',
          password: 'SecurePass123!',
        });
      const token = login.body.data.token;

      const events: any[] = [];
      const ws = await connectAndSubscribe(token, 'test.errors.**', events);

      // Inject an error-prone handler into EventBus
      const errorHandler = () => {
        throw new Error('Simulated handler error');
      };
      eventBus.on('test.error', errorHandler);

      // Trigger the error event (this would normally come from app logic)
      eventBus.emit({
        eventId: 'test-error-1',
        eventType: 'test.error',
        timestamp: new Date(),
        data: { test: 'error data' },
      });

      // System should continue functioning - send a normal message
      const normalMessage = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${token}`)
        .send({
          content: 'Message after error',
          channelId: 'test-channel',
        })
        .expect(201);

      expect(normalMessage.body.success).toBe(true);

      // Cleanup
      eventBus.off('test.error', errorHandler);
      ws.close();
    });
  });

  // Helper function
  async function connectAndSubscribe(
    token: string,
    topic: string,
    eventCollector: any[]
  ): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);

      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'auth',
          token: token,
        }));
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'auth_success') {
          ws.send(JSON.stringify({
            type: 'subscribe',
            topic: topic,
          }));
        } else if (message.type === 'subscribed') {
          resolve(ws);
        } else if (message.type === 'message') {
          // Collect events in the same handler (avoid duplicate listeners)
          eventCollector.push(message);
        }
      });

      ws.on('error', reject);
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });
  }
});
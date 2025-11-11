/**
 * End-to-End User Journey Tests
 *
 * Tests complete user workflows across HTTP and WebSocket protocols
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import WebSocket from 'ws';
import type { Server } from 'http';
import type { Express } from 'express';
import { httpServer } from '@application/http/http-server';
import { connectionManager } from '@application/websocket/connection-manager';
import { initializeMessageHandler, initializeWebSocketServer, initializeEventBridge } from '@application/websocket';
import { pubSubBroker } from '@infrastructure/pubsub/pubsub-broker';
import { eventBus } from '@infrastructure/events/event-bus';
import { database } from '@integration/database/connection-pool';
import { redisClient } from '@integration/cache/redis-client';

describe('E2E User Journey Tests', () => {
  let server: Server;
  let app: Express;
  let wsUrl: string;
  let apiUrl: string;
  let websocketServer: any;
  let eventBridge: any;

  beforeAll(async () => {
    // Connect services
    await database.connect();
    await pubSubBroker.connect();

    // Get Express app
    app = httpServer['app'];

    // Start server
    server = await new Promise<Server>((resolve) => {
      const srv = app.listen(0, () => resolve(srv));
    });

    const address = server.address();
    const port = typeof address === 'object' && address !== null ? address.port : 3000;

    // Initialize WebSocket server
    const messageHandler = initializeMessageHandler(connectionManager);
    websocketServer = initializeWebSocketServer(connectionManager, messageHandler);
    await websocketServer.start(server);

    // Initialize event bridge
    eventBridge = initializeEventBridge(eventBus, pubSubBroker);
    await eventBridge.start();

    wsUrl = `ws://localhost:${port}/ws`;
    apiUrl = `http://localhost:${port}`;
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
    // Clean database
    await database.query('DELETE FROM messages');
    await database.query('DELETE FROM users');
  });

  describe('Complete User Registration and Authentication Flow', () => {
    it('should handle user registration, login, and WebSocket authentication', async () => {
      const userData = {
        email: 'e2e.test@example.com',
        name: 'EtoE Test User',
        password: 'SecurePass123!',
      };

      // Step 1: Register user via HTTP
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(registerResponse.body.success).toBe(true);
      expect(registerResponse.body.data).toHaveProperty('id');
      expect(registerResponse.body.data.email).toBe(userData.email);

      const userId = registerResponse.body.data.id;

      // Step 2: Login via HTTP to get JWT
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password,
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
      expect(loginResponse.body.data).toHaveProperty('token');

      const accessToken = loginResponse.body.data.token;

      // Step 3: Connect to WebSocket and authenticate
      await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(wsUrl);

        ws.on('open', () => {
          // Send auth message
          ws.send(JSON.stringify({
            type: 'auth',
            token: accessToken,
          }));
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'auth_success') {
            expect(message.userId).toBe(userId);
            ws.close();
            resolve();
          } else if (message.type === 'auth_error') {
            reject(new Error('WebSocket authentication failed'));
          }
        });

        ws.on('error', reject);
        setTimeout(() => reject(new Error('WebSocket auth timeout')), 5000);
      });
    });
  });

  describe('Real-Time Messaging Flow', () => {
    it('should handle message sending via HTTP and receiving via WebSocket', async () => {
      // Setup: Create two users
      const user1 = {
        email: 'user1.e2e@example.com',
        name: 'User One',
        password: 'SecurePass123!',
      };

      const user2 = {
        email: 'user2.e2e@example.com',
        name: 'User Two',
        password: 'SecurePass123!',
      };

      // Register both users
      const [reg1, reg2] = await Promise.all([
        request(app).post('/api/auth/register').send(user1),
        request(app).post('/api/auth/register').send(user2),
      ]);

      const user1Id = reg1.body.data.id;
      const user2Id = reg2.body.data.id;

      // Login both users
      const [login1, login2] = await Promise.all([
        request(app).post('/api/auth/login').send({
          email: user1.email,
          password: user1.password,
        }),
        request(app).post('/api/auth/login').send({
          email: user2.email,
          password: user2.password,
        }),
      ]);

      const token1 = login1.body.data.token;
      const token2 = login2.body.data.token;

      // User 2 connects to WebSocket and subscribes to messages
      const ws2Messages: any[] = [];
      const ws2 = await new Promise<WebSocket>((resolve, reject) => {
        const socket = new WebSocket(wsUrl);

        socket.on('open', () => {
          socket.send(JSON.stringify({
            type: 'auth',
            token: token2,
          }));
        });

        socket.on('message', (data) => {
          const message = JSON.parse(data.toString());

          if (message.type === 'auth_success') {
            // Subscribe to messages for this user
            socket.send(JSON.stringify({
              type: 'subscribe',
              topic: `messages.user.${user2Id}`,
            }));
          } else if (message.type === 'subscribed') {
            resolve(socket);
          } else if (message.type === 'message') {
            ws2Messages.push(message);
          }
        });

        socket.on('error', reject);
        setTimeout(() => reject(new Error('WS2 setup timeout')), 5000);
      });

      // User 1 sends a message via HTTP
      const messageContent = 'Hello User 2 from E2E test!';
      const sendResponse = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          content: messageContent,
          recipientId: user2Id,
        })
        .expect(201);

      expect(sendResponse.body.success).toBe(true);
      const sentMessageId = sendResponse.body.data.id;

      // Wait for message to propagate
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify User 2 received the message via WebSocket
      const receivedMessage = ws2Messages.find(m =>
        m.data && m.data.message && m.data.message.id === sentMessageId
      );

      expect(receivedMessage).toBeDefined();
      if (receivedMessage) {
        expect(receivedMessage.data.message.content).toBe(messageContent);
        expect(receivedMessage.data.message.userId).toBe(user1Id);
      }

      ws2.close();
    });
  });

  describe('Multi-User Collaboration', () => {
    it('should handle multiple users in a channel with real-time updates', async () => {
      // Create 3 users
      const users = await Promise.all([
        request(app).post('/api/auth/register').send({
          email: 'collab1@example.com',
          name: 'Collab User One',
          password: 'SecurePass123!',
        }),
        request(app).post('/api/auth/register').send({
          email: 'collab2@example.com',
          name: 'Collab User Two',
          password: 'SecurePass123!',
        }),
        request(app).post('/api/auth/register').send({
          email: 'collab3@example.com',
          name: 'Collab User Three',
          password: 'SecurePass123!',
        }),
      ]);

      // Login all users
      const logins = await Promise.all(
        users.map(u =>
          request(app).post('/api/auth/login').send({
            email: u.body.data.email,
            password: 'SecurePass123!',
          })
        )
      );

      const tokens = logins.map(l => l.body.data.accessToken);
      const channelId = 'test-channel-123';

      // Connect all users to WebSocket and subscribe to channel
      const connections = await Promise.all(
        tokens.map((token, idx) => createWebSocketConnection(token, `messages.channel.${channelId}`))
      );

      const messagesByUser: any[][] = [[], [], []];

      connections.forEach((ws, idx) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'message') {
            messagesByUser[idx].push(message);
          }
        });
      });

      // User 1 sends a message to the channel
      const message1 = 'Hello from User One!';
      await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${tokens[0]}`)
        .send({
          content: message1,
          channelId: channelId,
        })
        .expect(201);

      // User 2 sends a message to the channel
      const message2 = 'Hello from User Two!';
      await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${tokens[1]}`)
        .send({
          content: message2,
          channelId: channelId,
        })
        .expect(201);

      // Wait for messages to propagate
      await new Promise(resolve => setTimeout(resolve, 1000));

      // All users should have received both messages
      messagesByUser.forEach((messages, userIdx) => {
        const msg1 = messages.find(m =>
          m.data && m.data.message && m.data.message.content === message1
        );
        const msg2 = messages.find(m =>
          m.data && m.data.message && m.data.message.content === message2
        );

        expect(msg1).toBeDefined();
        expect(msg2).toBeDefined();
      });

      // Cleanup
      connections.forEach(ws => ws.close());
    });

    async function createWebSocketConnection(token: string, topic: string): Promise<WebSocket> {
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
          }
        });

        ws.on('error', reject);
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });
    }
  });

  describe('Event Propagation Across Protocols', () => {
    it('should propagate user events from HTTP to WebSocket subscribers', async () => {
      // Register initial user
      const adminUser = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'admin.e2e@example.com',
          name: 'Admin User',
          password: 'SecurePass123!',
        });

      // Login admin to get token
      const adminLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin.e2e@example.com',
          password: 'SecurePass123!',
        });
      const adminToken = adminLogin.body.data.token;

      // Admin connects to WebSocket and subscribes to user events
      const adminEvents: any[] = [];
      const adminWs = await new Promise<WebSocket>((resolve, reject) => {
        const ws = new WebSocket(wsUrl);

        ws.on('open', () => {
          ws.send(JSON.stringify({
            type: 'auth',
            token: adminToken,
          }));
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());

          if (message.type === 'auth_success') {
            // Subscribe to user events
            ws.send(JSON.stringify({
              type: 'subscribe',
              topic: 'users.**',
            }));
          } else if (message.type === 'subscribed') {
            resolve(ws);
          } else if (message.type === 'message') {
            adminEvents.push(message);
          }
        });

        ws.on('error', reject);
        setTimeout(() => reject(new Error('Admin WS timeout')), 5000);
      });

      // New user registers (should trigger user.created event)
      const newUser = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser.e2e@example.com',
          name: 'New User',
          password: 'SecurePass123!',
        });

      const newUserId = newUser.body.data.id;
      // Login new user to get token
      const newUserLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'newuser.e2e@example.com',
          password: 'SecurePass123!',
        });
      const newUserToken = newUserLogin.body.data.token;

      // Wait for event propagation
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check if admin received user.created event
      const userCreatedEvent = adminEvents.find(e =>
        e.topic === 'users' &&
        e.data &&
        e.data.user &&
        e.data.user.id === newUserId
      );

      expect(userCreatedEvent).toBeDefined();

      // New user updates their profile
      await request(app)
        .put(`/api/users/${newUserId}`)
        .set('Authorization', `Bearer ${newUserToken}`)
        .send({
          name: 'Updated Name',
        })
        .expect(200);

      // Wait for event propagation
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check if admin received user.updated event
      const userUpdatedEvent = adminEvents.find(e =>
        e.topic === `users.user.${newUserId}` &&
        e.data &&
        e.data.user &&
        e.data.user.name === 'Updated Name'
      );

      expect(userUpdatedEvent).toBeDefined();

      adminWs.close();
    });
  });

  describe('System Resilience and Recovery', () => {
    it('should handle connection drops and reconnection gracefully', async () => {
      // Register user
      const user = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'resilient@example.com',
          name: 'Resilient User',
          password: 'SecurePass123!',
        });

      // Login to get token
      const login = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'resilience.e2e@example.com',
          password: 'SecurePass123!',
        })
        .expect(200);
      const token = login.body.data?.token;
      const userId = user.body.data.id;

      // First connection
      let ws1 = await new Promise<WebSocket>((resolve, reject) => {
        const socket = new WebSocket(wsUrl);

        socket.on('open', () => {
          socket.send(JSON.stringify({
            type: 'auth',
            token: token,
          }));
        });

        socket.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'auth_success') {
            socket.send(JSON.stringify({
              type: 'subscribe',
              topic: `messages.user.${userId}`,
            }));
          } else if (message.type === 'subscribed') {
            resolve(socket);
          }
        });

        socket.on('error', reject);
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });

      // Simulate connection drop
      ws1.close();

      // Verify connection is closed
      expect(ws1.readyState).toBe(WebSocket.CLOSED);

      // Reconnect
      const ws2Messages: any[] = [];
      const ws2 = await new Promise<WebSocket>((resolve, reject) => {
        const socket = new WebSocket(wsUrl);

        socket.on('open', () => {
          socket.send(JSON.stringify({
            type: 'auth',
            token: token,
          }));
        });

        socket.on('message', (data) => {
          const message = JSON.parse(data.toString());

          if (message.type === 'auth_success') {
            socket.send(JSON.stringify({
              type: 'subscribe',
              topic: `messages.user.${userId}`,
            }));
          } else if (message.type === 'subscribed') {
            resolve(socket);
          } else if (message.type === 'message') {
            ws2Messages.push(message);
          }
        });

        socket.on('error', reject);
        setTimeout(() => reject(new Error('Reconnection timeout')), 5000);
      });

      // Send a message to verify the new connection works
      await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${token}`)
        .send({
          content: 'Test after reconnection',
          recipientId: userId,
        })
        .expect(201);

      // Wait for message
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify message received on new connection
      expect(ws2Messages.length).toBeGreaterThan(0);
      const receivedMessage = ws2Messages[0];
      expect(receivedMessage.data.message.content).toBe('Test after reconnection');

      ws2.close();
    });

    it('should handle rapid connection/disconnection cycles', async () => {
      // Register user
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'rapid.e2e@example.com',
          name: 'Rapid User',
          password: 'SecurePass123!',
        });

      // Login to get token
      const login = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'rapid.e2e@example.com',
          password: 'SecurePass123!',
        });
      const token = login.body.data.token;

      // Rapid connect/disconnect cycle
      for (let i = 0; i < 5; i++) {
        const ws = await new Promise<WebSocket>((resolve, reject) => {
          const socket = new WebSocket(wsUrl);

          socket.on('open', () => {
            socket.send(JSON.stringify({
              type: 'auth',
              token: token,
            }));
          });

          socket.on('message', (data) => {
            const message = JSON.parse(data.toString());
            if (message.type === 'auth_success') {
              resolve(socket);
            }
          });

          socket.on('error', reject);
          setTimeout(() => reject(new Error('Connection timeout')), 5000);
        });

        // Immediately close
        ws.close();

        // Small delay before next iteration
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // System should still be stable - verify with one more connection
      const finalWs = await new Promise<WebSocket>((resolve, reject) => {
        const socket = new WebSocket(wsUrl);

        socket.on('open', () => {
          socket.send(JSON.stringify({
            type: 'auth',
            token: token,
          }));
        });

        socket.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'auth_success') {
            resolve(socket);
          }
        });

        socket.on('error', reject);
        setTimeout(() => reject(new Error('Final connection timeout')), 5000);
      });

      expect(finalWs.readyState).toBe(WebSocket.OPEN);
      finalWs.close();
    });
  });

  describe('Performance Under Load', () => {
    it('should handle concurrent operations across protocols', async () => {
      // Create multiple users
      const userCount = 10;
      const users = await Promise.all(
        Array.from({ length: userCount }, (_, i) =>
          request(app)
            .post('/api/auth/register')
            .send({
              email: `load.user${i}@example.com`,
              name: `Load User`,
              password: 'SecurePass123!',
            })
        )
      );

      // Login all users
      const tokens = await Promise.all(
        users.map(u =>
          request(app)
            .post('/api/auth/login')
            .send({
              email: u.body.data.email,
              password: 'SecurePass123!',
            })
            .then(res => res.body.data.accessToken)
        )
      );

      // Connect all users to WebSocket simultaneously
      const connections = await Promise.all(
        tokens.map(token =>
          new Promise<WebSocket>((resolve, reject) => {
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
                  topic: 'broadcast.**',
                }));
              } else if (message.type === 'subscribed') {
                resolve(ws);
              }
            });

            ws.on('error', reject);
            setTimeout(() => reject(new Error('Connection timeout')), 10000);
          })
        )
      );

      // All connections should be established
      expect(connections.length).toBe(userCount);
      connections.forEach(ws => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
      });

      // Send messages from all users simultaneously
      const messagePromises = tokens.map((token, i) =>
        request(app)
          .post('/api/messages')
          .set('Authorization', `Bearer ${token}`)
          .send({
            content: `Concurrent message ${i}`,
            channelId: 'load-test-channel',
          })
      );

      const results = await Promise.all(messagePromises);

      // All messages should be sent successfully
      results.forEach(res => {
        expect(res.status).toBe(201);
      });

      // Cleanup
      connections.forEach(ws => ws.close());
    });
  });
});
/**
 * TCP Integration Tests
 * Tests complete TCP server flows with real client connections
 *
 * These tests use actual TCP sockets to validate:
 * - Connection establishment
 * - Authentication flows
 * - Message routing
 * - Pub/sub functionality
 * - Error handling
 * - Connection limits
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import * as net from 'net';
import { TcpServer } from '@protocols/tcp/tcp-server';
import { TcpMessageHandler } from '@protocols/tcp/message-handler';
import { ProtocolCodec } from '@protocols/tcp/protocol-codec';
import { TcpMessageType } from '@shared/types/tcp-types';
import { ValidatedConfig } from '@infrastructure/config/config-schema';

// Mock dependencies that don't need real implementations
vi.mock('@infrastructure/logging/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
  },
  logStartup: vi.fn(),
  logShutdown: vi.fn(),
  logUncaughtException: vi.fn(),
  logUnhandledRejection: vi.fn(),
}));

vi.mock('@domain/auth/jwt-service', () => ({
  jwtService: {
    verifyToken: vi.fn((token: string) => {
      if (token === 'valid-token') {
        return { userId: 'test-user-123' };
      }
      throw new Error('Invalid token');
    }),
    generateAccessToken: vi.fn(() => 'valid-token'),
  },
}));

vi.mock('@infrastructure/database/repositories/user-repository', () => ({
  userRepository: {
    findById: vi.fn((id: string) => {
      if (id === 'test-user-123') {
        return Promise.resolve({
          id: 'test-user-123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'user',
          passwordHash: 'hash',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      return Promise.resolve(null);
    }),
  },
}));

vi.mock('@infrastructure/pubsub/pubsub-broker', () => {
  const subscriptions = new Map<string, Set<Function>>();

  return {
    pubSubBroker: {
      connect: vi.fn(() => Promise.resolve()),
      disconnect: vi.fn(() => Promise.resolve()),
      subscribe: vi.fn((topic: string, callback: Function) => {
        if (!subscriptions.has(topic)) {
          subscriptions.set(topic, new Set());
        }
        subscriptions.get(topic)!.add(callback);
        return Promise.resolve(`sub-${topic}-${Date.now()}`);
      }),
      unsubscribe: vi.fn((subscriptionId: string) => {
        // In real implementation, would remove by ID
        return Promise.resolve();
      }),
      publish: vi.fn((topic: string, data: any) => {
        const callbacks = subscriptions.get(topic);
        if (callbacks) {
          callbacks.forEach((callback) => callback(data));
        }
        return Promise.resolve();
      }),
    },
  };
});

describe('TCP Integration Tests', () => {
  let server: TcpServer;
  let messageHandler: TcpMessageHandler;
  let codec: ProtocolCodec;
  const TEST_PORT = 9999;
  const TEST_HOST = '127.0.0.1';

  beforeAll(async () => {
    codec = new ProtocolCodec({ maxFrameSize: 1024 * 1024 });

    const config: ValidatedConfig = {
      tcp: {
        enabled: true,
        host: TEST_HOST,
        port: TEST_PORT,
        maxConnections: 10,
        maxConnectionsPerIp: 3,
        maxFrameSize: 1024 * 1024,
        pingInterval: 30000,
        pingTimeout: 60000,
        keepAliveInterval: 10000,
        frameParserConfig: {
          maxFrameSize: 1024 * 1024,
        },
        protocolCodecConfig: {
          maxFrameSize: 1024 * 1024,
        },
      },
    } as ValidatedConfig;

    server = new TcpServer(config);
    await server.start();

    // Create message handler to process incoming messages
    messageHandler = new TcpMessageHandler(server);

    // Give server time to start
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('Connection establishment', () => {
    afterEach(async () => {
      // Give server time to clean up connections
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    it('should accept TCP client connections', async () => {
      const client = new net.Socket();

      await new Promise<void>((resolve, reject) => {
        client.connect(TEST_PORT, TEST_HOST, () => {
          expect(client.destroyed).toBe(false);
          client.destroy();
          resolve();
        });

        client.on('error', reject);

        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });
    });

    it('should handle multiple concurrent connections', async () => {
      const clients: net.Socket[] = [];
      const connectionCount = 3;

      try {
        const connections = await Promise.all(
          Array.from({ length: connectionCount }, () => {
            return new Promise<net.Socket>((resolve, reject) => {
              const client = new net.Socket();
              clients.push(client);

              client.connect(TEST_PORT, TEST_HOST, () => {
                resolve(client);
              });

              client.on('error', reject);
              setTimeout(() => reject(new Error('Connection timeout')), 5000);
            });
          })
        );

        expect(connections).toHaveLength(connectionCount);
        connections.forEach((client) => {
          expect(client.destroyed).toBe(false);
        });
      } finally {
        clients.forEach((client) => client.destroy());
      }
    });

    it('should enforce per-IP connection limits', async () => {
      const clients: net.Socket[] = [];
      const maxPerIp = 3;

      try {
        // Connect up to the limit
        for (let i = 0; i < maxPerIp; i++) {
          const client = new net.Socket();
          clients.push(client);

          await new Promise<void>((resolve, reject) => {
            client.connect(TEST_PORT, TEST_HOST, () => resolve());
            client.on('error', reject);
            setTimeout(() => reject(new Error('Connection timeout')), 5000);
          });
        }

        // Try to exceed limit
        const extraClient = new net.Socket();
        clients.push(extraClient);

        await new Promise<void>((resolve, reject) => {
          let errorReceived = false;

          extraClient.connect(TEST_PORT, TEST_HOST, () => {
            // Connection established, but should receive error frame
          });

          extraClient.on('data', (data) => {
            // Should receive error message
            errorReceived = true;
          });

          extraClient.on('close', () => {
            // Connection should be closed after error
            resolve();
          });

          extraClient.on('error', () => {
            // Socket error is also acceptable
            resolve();
          });

          setTimeout(() => {
            if (!errorReceived && !extraClient.destroyed) {
              reject(new Error('Expected connection to be rejected'));
            } else {
              resolve();
            }
          }, 2000);
        });
      } finally {
        clients.forEach((client) => {
          if (!client.destroyed) {
            client.destroy();
          }
        });
      }
    });
  });

  describe('Authentication flow', () => {
    let client: net.Socket;

    beforeEach(() => {
      client = new net.Socket();
    });

    afterEach(() => {
      if (client && !client.destroyed) {
        client.destroy();
      }
    });

    it('should authenticate with valid JWT token', async () => {
      await new Promise<void>((resolve, reject) => {
        client.connect(TEST_PORT, TEST_HOST, () => {
          // Send AUTH message
          const authMessage = codec.encode({
            type: TcpMessageType.AUTH,
            data: { token: 'valid-token' },
          });

          client.write(authMessage);
        });

        client.on('data', (data) => {
          try {
            const frameSize = data.readUInt32BE(0);
            const messageType = data.readUInt8(4);
            const payload = data.slice(5, 4 + frameSize);

            if (messageType === TcpMessageType.AUTH_SUCCESS) {
              const message = JSON.parse(payload.toString('utf8'));
              expect(message.userId).toBe('test-user-123');
              expect(message.message).toContain('Authentication successful');
              resolve();
            } else if (messageType === TcpMessageType.ERROR) {
              const message = JSON.parse(payload.toString('utf8'));
              reject(new Error(`AUTH failed: ${message.error || message.message || 'Unknown error'}`));
            }
          } catch (error) {
            reject(error);
          }
        });

        client.on('error', reject);
        setTimeout(() => reject(new Error('Auth timeout')), 5000);
      });
    });

    it('should reject invalid JWT token', async () => {
      await new Promise<void>((resolve, reject) => {
        client.connect(TEST_PORT, TEST_HOST, () => {
          // Send AUTH message with invalid token
          const authMessage = codec.encode({
            type: TcpMessageType.AUTH,
            data: { token: 'invalid-token' },
          });

          client.write(authMessage);
        });

        client.on('data', (data) => {
          try {
            const frameSize = data.readUInt32BE(0);
            const messageType = data.readUInt8(4);

            if (messageType === TcpMessageType.ERROR) {
              const payload = data.slice(5, 4 + frameSize);
              const message = JSON.parse(payload.toString('utf8'));
              expect(message.error).toBeDefined();
              resolve();
            }
          } catch (error) {
            reject(error);
          }
        });

        client.on('error', reject);
        setTimeout(() => reject(new Error('Auth timeout')), 5000);
      });
    });

    it('should reject operations before authentication', async () => {
      await new Promise<void>((resolve, reject) => {
        client.connect(TEST_PORT, TEST_HOST, () => {
          // Try to subscribe without authenticating first
          const subscribeMessage = codec.encode({
            type: TcpMessageType.SUBSCRIBE,
            data: { topic: 'test-topic' },
          });

          client.write(subscribeMessage);
        });

        client.on('data', (data) => {
          try {
            const frameSize = data.readUInt32BE(0);
            const messageType = data.readUInt8(4);

            if (messageType === TcpMessageType.ERROR) {
              const payload = data.slice(5, 4 + frameSize);
              const message = JSON.parse(payload.toString('utf8'));
              expect(message.error).toContain('Authentication required');
              resolve();
            }
          } catch (error) {
            reject(error);
          }
        });

        client.on('error', reject);
        setTimeout(() => reject(new Error('Subscribe timeout')), 5000);
      });
    });
  });

  describe('Pub/Sub functionality', () => {
    let client1: net.Socket;
    let client2: net.Socket;

    beforeEach(() => {
      client1 = new net.Socket();
      client2 = new net.Socket();
    });

    afterEach(() => {
      if (client1 && !client1.destroyed) client1.destroy();
      if (client2 && !client2.destroyed) client2.destroy();
    });

    it('should subscribe to topic after authentication', async () => {
      await new Promise<void>((resolve, reject) => {
        let authenticated = false;

        client1.connect(TEST_PORT, TEST_HOST, () => {
          // First authenticate
          const authMessage = codec.encode({
            type: TcpMessageType.AUTH,
            data: { token: 'valid-token' },
          });
          client1.write(authMessage);
        });

        client1.on('data', (data) => {
          try {
            const frameSize = data.readUInt32BE(0);
            const messageType = data.readUInt8(4);
            const payload = data.slice(5, 4 + frameSize);

            if (messageType === TcpMessageType.AUTH_SUCCESS && !authenticated) {
              authenticated = true;
              // Now subscribe
              const subscribeMessage = codec.encode({
                type: TcpMessageType.SUBSCRIBE,
                data: { topic: 'test-topic' },
              });
              client1.write(subscribeMessage);
            } else if (messageType === TcpMessageType.SUBSCRIBED && authenticated) {
              const message = JSON.parse(payload.toString('utf8'));
              expect(message.topic).toBe('test-topic');
              expect(message.subscriptionId).toBeDefined();
              resolve();
            }
          } catch (error) {
            reject(error);
          }
        });

        client1.on('error', reject);
        setTimeout(() => reject(new Error('Subscribe timeout')), 5000);
      });
    });

    it('should receive published messages on subscribed topic', async () => {
      await new Promise<void>((resolve, reject) => {
        let client1Authenticated = false;
        let client1Subscribed = false;
        let client2Authenticated = false;

        // Setup client1 as subscriber
        client1.connect(TEST_PORT, TEST_HOST, () => {
          const authMessage = codec.encode({
            type: TcpMessageType.AUTH,
            data: { token: 'valid-token' },
          });
          client1.write(authMessage);
        });

        client1.on('data', (data) => {
          try {
            let offset = 0;

            while (offset < data.length) {
              const frameSize = data.readUInt32BE(offset);
              const messageType = data.readUInt8(offset + 4);
              const payload = data.slice(offset + 5, offset + 4 + frameSize);

              if (messageType === TcpMessageType.AUTH_SUCCESS && !client1Authenticated) {
                client1Authenticated = true;
                const subscribeMessage = codec.encode({
                  type: TcpMessageType.SUBSCRIBE,
                  data: { topic: 'pub-test-topic' },
                });
                client1.write(subscribeMessage);
              } else if (messageType === TcpMessageType.SUBSCRIBED && !client1Subscribed) {
                client1Subscribed = true;
                // Now connect client2 to publish
                client2.connect(TEST_PORT, TEST_HOST, () => {
                  const authMessage = codec.encode({
                    type: TcpMessageType.AUTH,
                    data: { token: 'valid-token' },
                  });
                  client2.write(authMessage);
                });
              } else if (messageType === TcpMessageType.SERVER_MESSAGE) {
                const message = JSON.parse(payload.toString('utf8'));
                expect(message.topic).toBe('pub-test-topic');
                expect(message.content).toEqual({ test: 'data' });
                resolve();
              }

              offset += 4 + frameSize;
            }
          } catch (error) {
            reject(error);
          }
        });

        client2.on('data', (data) => {
          try {
            const frameSize = data.readUInt32BE(0);
            const messageType = data.readUInt8(4);

            if (messageType === TcpMessageType.AUTH_SUCCESS && !client2Authenticated) {
              client2Authenticated = true;
              // Publish message
              const publishMessage = codec.encode({
                type: TcpMessageType.MESSAGE,
                data: {
                  topic: 'pub-test-topic',
                  content: { test: 'data' },
                },
              });
              client2.write(publishMessage);
            }
          } catch (error) {
            reject(error);
          }
        });

        client1.on('error', reject);
        client2.on('error', reject);
        setTimeout(() => reject(new Error('Pub/sub timeout')), 10000);
      });
    });

    it('should unsubscribe from topic', async () => {
      await new Promise<void>((resolve, reject) => {
        let authenticated = false;
        let subscribed = false;

        client1.connect(TEST_PORT, TEST_HOST, () => {
          const authMessage = codec.encode({
            type: TcpMessageType.AUTH,
            data: { token: 'valid-token' },
          });
          client1.write(authMessage);
        });

        client1.on('data', (data) => {
          try {
            const frameSize = data.readUInt32BE(0);
            const messageType = data.readUInt8(4);
            const payload = data.slice(5, 4 + frameSize);

            if (messageType === TcpMessageType.AUTH_SUCCESS && !authenticated) {
              authenticated = true;
              const subscribeMessage = codec.encode({
                type: TcpMessageType.SUBSCRIBE,
                data: { topic: 'unsub-topic' },
              });
              client1.write(subscribeMessage);
            } else if (messageType === TcpMessageType.SUBSCRIBED && !subscribed) {
              subscribed = true;
              // Now unsubscribe
              const unsubscribeMessage = codec.encode({
                type: TcpMessageType.UNSUBSCRIBE,
                data: { topic: 'unsub-topic' },
              });
              client1.write(unsubscribeMessage);
            } else if (messageType === TcpMessageType.UNSUBSCRIBED && subscribed) {
              const message = JSON.parse(payload.toString('utf8'));
              expect(message.topic).toBe('unsub-topic');
              resolve();
            }
          } catch (error) {
            reject(error);
          }
        });

        client1.on('error', reject);
        setTimeout(() => reject(new Error('Unsubscribe timeout')), 5000);
      });
    });
  });

  describe('Ping/Pong keepalive', () => {
    let client: net.Socket;

    beforeEach(() => {
      client = new net.Socket();
    });

    afterEach(() => {
      if (client && !client.destroyed) {
        client.destroy();
      }
    });

    it('should respond to PING with PONG', async () => {
      await new Promise<void>((resolve, reject) => {
        client.connect(TEST_PORT, TEST_HOST, () => {
          const pingMessage = codec.encode({
            type: TcpMessageType.PING,
            data: { timestamp: Date.now() },
          });
          client.write(pingMessage);
        });

        client.on('data', (data) => {
          try {
            const frameSize = data.readUInt32BE(0);
            const messageType = data.readUInt8(4);

            if (messageType === TcpMessageType.PONG) {
              const payload = data.slice(5, 4 + frameSize);
              const message = JSON.parse(payload.toString('utf8'));
              expect(message.timestamp).toBeDefined();
              resolve();
            }
          } catch (error) {
            reject(error);
          }
        });

        client.on('error', reject);
        setTimeout(() => reject(new Error('Ping timeout')), 5000);
      });
    });
  });

  describe('Error handling', () => {
    let client: net.Socket;

    beforeEach(() => {
      client = new net.Socket();
    });

    afterEach(() => {
      if (client && !client.destroyed) {
        client.destroy();
      }
    });

    it('should handle invalid message format gracefully', async () => {
      await new Promise<void>((resolve, reject) => {
        client.connect(TEST_PORT, TEST_HOST, () => {
          // Send malformed data
          client.write(Buffer.from('invalid data'));
        });

        client.on('data', (data) => {
          try {
            const frameSize = data.readUInt32BE(0);
            const messageType = data.readUInt8(4);

            if (messageType === TcpMessageType.ERROR) {
              resolve();
            }
          } catch (error) {
            // Expected to fail parsing
            resolve();
          }
        });

        client.on('close', () => {
          // Connection might be closed on protocol error
          resolve();
        });

        client.on('error', () => {
          // Socket error is acceptable
          resolve();
        });

        setTimeout(() => reject(new Error('Error handling timeout')), 5000);
      });
    });
  });
});

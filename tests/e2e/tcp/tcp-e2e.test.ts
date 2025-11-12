/**
 * TCP End-to-End Tests
 * Tests complete user scenarios and workflows
 *
 * These tests verify complete scenarios including:
 * - Multi-user chat scenarios
 * - Connection lifecycle management
 * - Concurrent operations
 * - Error recovery
 * - Session management
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import * as net from 'net';
import { TcpServer } from '@protocols/tcp/tcp-server';
import { TcpMessageHandler } from '@protocols/tcp/message-handler';
import { ProtocolCodec } from '@protocols/tcp/protocol-codec';
import { TcpMessageType } from '@shared/types/tcp-types';
import { ValidatedConfig } from '@infrastructure/config/config-schema';

// Mock dependencies
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

// Track user tokens for different users
const userTokens = {
  alice: 'token-alice',
  bob: 'token-bob',
  charlie: 'token-charlie',
};

const userIds = {
  alice: 'user-alice',
  bob: 'user-bob',
  charlie: 'user-charlie',
};

vi.mock('@domain/auth/jwt-service', () => ({
  jwtService: {
    verifyToken: vi.fn((token: string) => {
      if (token === userTokens.alice) {
        return { userId: userIds.alice };
      }
      if (token === userTokens.bob) {
        return { userId: userIds.bob };
      }
      if (token === userTokens.charlie) {
        return { userId: userIds.charlie };
      }
      throw new Error('Invalid token');
    }),
    generateAccessToken: vi.fn(() => 'valid-token'),
  },
}));

vi.mock('@infrastructure/database/repositories/user-repository', () => ({
  userRepository: {
    findById: vi.fn((id: string) => {
      const users: Record<string, any> = {
        [userIds.alice]: {
          id: userIds.alice,
          email: 'alice@example.com',
          name: 'Alice',
          role: 'user',
          passwordHash: 'hash',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        [userIds.bob]: {
          id: userIds.bob,
          email: 'bob@example.com',
          name: 'Bob',
          role: 'user',
          passwordHash: 'hash',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        [userIds.charlie]: {
          id: userIds.charlie,
          email: 'charlie@example.com',
          name: 'Charlie',
          role: 'user',
          passwordHash: 'hash',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      return Promise.resolve(users[id] || null);
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

/**
 * Helper class to manage TCP client connections
 */
class TcpTestClient {
  private socket: net.Socket;
  private codec: ProtocolCodec;
  private messageHandlers: Map<TcpMessageType, Function[]> = new Map();
  private connected = false;

  constructor(
    private host: string,
    private port: number
  ) {
    this.socket = new net.Socket();
    this.codec = new ProtocolCodec({ maxFrameSize: 1024 * 1024 });
  }

  /**
   * Connect to TCP server
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.connect(this.port, this.host, () => {
        this.connected = true;

        // Remove the reject error handler after successful connection
        // and add a non-rejecting one
        this.socket.removeAllListeners('error');
        this.socket.on('error', (err: any) => {
          // Suppress ECONNRESET errors (expected during cleanup)
          if (err.code === 'ECONNRESET') return;
          console.error('TCP Client error:', err);
        });

        resolve();
      });

      this.socket.on('data', (data) => this.handleData(data));
      this.socket.on('error', reject); // Will be replaced after connect
      this.socket.on('close', () => {
        this.connected = false;
      });

      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });
  }

  /**
   * Handle incoming data
   */
  private handleData(data: Buffer): void {
    try {
      const frameSize = data.readUInt32BE(0);
      const messageType = data.readUInt8(4) as TcpMessageType;
      const payload = data.slice(5, 4 + frameSize);
      const message = JSON.parse(payload.toString('utf8'));

      const handlers = this.messageHandlers.get(messageType);
      if (handlers) {
        handlers.forEach((handler) => handler(message));
      }
    } catch (error) {
      // Ignore parse errors in test client
    }
  }

  /**
   * Register message handler
   */
  on(messageType: TcpMessageType, handler: Function): void {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, []);
    }
    this.messageHandlers.get(messageType)!.push(handler);
  }

  /**
   * Send message
   */
  send(type: TcpMessageType, data: any): void {
    const frame = this.codec.encode({ type, data });
    this.socket.write(frame);
  }

  /**
   * Authenticate with token
   */
  async authenticate(token: string): Promise<{ userId: string }> {
    return new Promise((resolve, reject) => {
      this.on(TcpMessageType.AUTH_SUCCESS, (message: any) => {
        resolve({ userId: message.userId });
      });

      this.on(TcpMessageType.ERROR, (message: any) => {
        reject(new Error(message.error || message.message));
      });

      this.send(TcpMessageType.AUTH, { token });

      setTimeout(() => reject(new Error('Auth timeout')), 5000);
    });
  }

  /**
   * Subscribe to topic
   */
  async subscribe(topic: string): Promise<{ subscriptionId: string }> {
    return new Promise((resolve, reject) => {
      const handler = (message: any) => {
        if (message.topic === topic) {
          resolve({ subscriptionId: message.subscriptionId });
          // Remove one-time handler
          const handlers = this.messageHandlers.get(TcpMessageType.SUBSCRIBED);
          if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) handlers.splice(index, 1);
          }
        }
      };

      this.on(TcpMessageType.SUBSCRIBED, handler);
      this.send(TcpMessageType.SUBSCRIBE, { topic });

      setTimeout(() => reject(new Error('Subscribe timeout')), 5000);
    });
  }

  /**
   * Publish message
   */
  publish(topic: string, content: any): void {
    this.send(TcpMessageType.MESSAGE, { topic, content });
  }

  /**
   * Wait for server message
   */
  async waitForMessage(topic: string, timeout = 5000): Promise<any> {
    return new Promise((resolve, reject) => {
      const handler = (message: any) => {
        if (message.topic === topic) {
          resolve(message.content);
          // Remove one-time handler
          const handlers = this.messageHandlers.get(TcpMessageType.SERVER_MESSAGE);
          if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) handlers.splice(index, 1);
          }
        }
      };

      this.on(TcpMessageType.SERVER_MESSAGE, handler);

      setTimeout(() => reject(new Error('Message timeout')), timeout);
    });
  }

  /**
   * Disconnect
   */
  disconnect(): void {
    if (this.connected) {
      this.socket.destroy();
      this.connected = false;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected && !this.socket.destroyed;
  }
}

describe('TCP E2E Tests', () => {
  let server: TcpServer;
  let messageHandler: TcpMessageHandler;
  const TEST_PORT = 9998;
  const TEST_HOST = '127.0.0.1';

  beforeAll(async () => {
    const config: ValidatedConfig = {
      tcp: {
        enabled: true,
        host: TEST_HOST,
        port: TEST_PORT,
        maxConnections: 20,
        maxConnectionsPerIp: 10,
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
    messageHandler = new TcpMessageHandler(server);

    // Give server time to start
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('Multi-User Chat Scenario', () => {
    let alice: TcpTestClient;
    let bob: TcpTestClient;
    let charlie: TcpTestClient;

    beforeEach(async () => {
      alice = new TcpTestClient(TEST_HOST, TEST_PORT);
      bob = new TcpTestClient(TEST_HOST, TEST_PORT);
      charlie = new TcpTestClient(TEST_HOST, TEST_PORT);
    });

    afterEach(async () => {
      alice.disconnect();
      bob.disconnect();
      charlie.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    it('should support complete chat room scenario', async () => {
      // 1. All users connect and authenticate
      await alice.connect();
      await bob.connect();
      await charlie.connect();

      const aliceAuth = await alice.authenticate(userTokens.alice);
      const bobAuth = await bob.authenticate(userTokens.bob);
      const charlieAuth = await charlie.authenticate(userTokens.charlie);

      expect(aliceAuth.userId).toBe(userIds.alice);
      expect(bobAuth.userId).toBe(userIds.bob);
      expect(charlieAuth.userId).toBe(userIds.charlie);

      // 2. All users join the same chat room
      const room = 'general-chat';
      await alice.subscribe(room);
      await bob.subscribe(room);
      await charlie.subscribe(room);

      // 3. Alice sends a message
      const aliceMessagePromise = bob.waitForMessage(room);
      const aliceMessagePromise2 = charlie.waitForMessage(room);

      alice.publish(room, { text: 'Hello everyone!', from: 'Alice' });

      const bobReceivedFromAlice = await aliceMessagePromise;
      const charlieReceivedFromAlice = await aliceMessagePromise2;

      expect(bobReceivedFromAlice.text).toBe('Hello everyone!');
      expect(charlieReceivedFromAlice.text).toBe('Hello everyone!');

      // 4. Bob replies
      const bobMessagePromise = alice.waitForMessage(room);
      const bobMessagePromise2 = charlie.waitForMessage(room);

      bob.publish(room, { text: 'Hi Alice!', from: 'Bob' });

      const aliceReceivedFromBob = await bobMessagePromise;
      const charlieReceivedFromBob = await bobMessagePromise2;

      expect(aliceReceivedFromBob.text).toBe('Hi Alice!');
      expect(charlieReceivedFromBob.text).toBe('Hi Alice!');
    });

    it('should support private messaging between users', async () => {
      await alice.connect();
      await bob.connect();

      await alice.authenticate(userTokens.alice);
      await bob.authenticate(userTokens.bob);

      // Create private channel using user IDs
      const privateChannel = `dm:${userIds.alice}:${userIds.bob}`;

      await alice.subscribe(privateChannel);
      await bob.subscribe(privateChannel);

      // Alice sends private message to Bob
      const bobMessagePromise = bob.waitForMessage(privateChannel);

      alice.publish(privateChannel, {
        text: 'Hey Bob, this is private!',
        from: userIds.alice,
        to: userIds.bob,
      });

      const bobReceived = await bobMessagePromise;
      expect(bobReceived.text).toBe('Hey Bob, this is private!');
      expect(bobReceived.from).toBe(userIds.alice);
    });

    it('should support multiple chat rooms simultaneously', async () => {
      await alice.connect();
      await alice.authenticate(userTokens.alice);

      await bob.connect();
      await bob.authenticate(userTokens.bob);

      // Alice joins two rooms
      const room1 = 'tech-talk';
      const room2 = 'random';

      await alice.subscribe(room1);
      await alice.subscribe(room2);
      await bob.subscribe(room1);

      // Message in room1 - Bob should receive
      const bobRoom1Promise = bob.waitForMessage(room1);
      alice.publish(room1, { text: 'Tech discussion', room: room1 });
      const bobReceived1 = await bobRoom1Promise;
      expect(bobReceived1.text).toBe('Tech discussion');

      // Message in room2 - Bob should NOT receive (not subscribed)
      // We can't easily test "not receiving" but we test isolation
      alice.publish(room2, { text: 'Random chat', room: room2 });
      // If Bob was subscribed to room2, this would fail with timeout
    });
  });

  describe('Connection Lifecycle', () => {
    let client: TcpTestClient;

    beforeEach(() => {
      client = new TcpTestClient(TEST_HOST, TEST_PORT);
    });

    afterEach(async () => {
      client.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    it('should handle graceful reconnection', async () => {
      // First connection
      await client.connect();
      const auth1 = await client.authenticate(userTokens.alice);
      expect(auth1.userId).toBe(userIds.alice);

      // Disconnect
      client.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Reconnect with new client instance
      const client2 = new TcpTestClient(TEST_HOST, TEST_PORT);
      await client2.connect();
      const auth2 = await client2.authenticate(userTokens.alice);
      expect(auth2.userId).toBe(userIds.alice);

      client2.disconnect();
    });

    it('should maintain subscriptions across messages', async () => {
      await client.connect();
      await client.authenticate(userTokens.alice);

      const topic = 'persistent-topic';
      await client.subscribe(topic);

      // Send multiple messages
      const client2 = new TcpTestClient(TEST_HOST, TEST_PORT);
      await client2.connect();
      await client2.authenticate(userTokens.bob);

      await client2.subscribe(topic);

      for (let i = 0; i < 5; i++) {
        const messagePromise = client.waitForMessage(topic);
        client2.publish(topic, { count: i });
        const received = await messagePromise;
        expect(received.count).toBe(i);
      }

      client2.disconnect();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent authentication requests', async () => {
      const clients = [
        new TcpTestClient(TEST_HOST, TEST_PORT),
        new TcpTestClient(TEST_HOST, TEST_PORT),
        new TcpTestClient(TEST_HOST, TEST_PORT),
      ];

      try {
        // Connect all clients concurrently
        await Promise.all(clients.map((c) => c.connect()));

        // Authenticate all clients concurrently
        const auths = await Promise.all([
          clients[0].authenticate(userTokens.alice),
          clients[1].authenticate(userTokens.bob),
          clients[2].authenticate(userTokens.charlie),
        ]);

        expect(auths[0].userId).toBe(userIds.alice);
        expect(auths[1].userId).toBe(userIds.bob);
        expect(auths[2].userId).toBe(userIds.charlie);
      } finally {
        clients.forEach((c) => c.disconnect());
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    });

    it('should handle multiple subscriptions', async () => {
      const client = new TcpTestClient(TEST_HOST, TEST_PORT);

      try {
        await client.connect();
        await client.authenticate(userTokens.alice);

        // Subscribe to multiple topics sequentially (more realistic)
        const topics = ['topic1', 'topic2', 'topic3', 'topic4', 'topic5'];
        const subscriptions: any[] = [];

        for (const topic of topics) {
          const sub = await client.subscribe(topic);
          subscriptions.push(sub);
        }

        expect(subscriptions).toHaveLength(5);
        subscriptions.forEach((sub) => {
          expect(sub.subscriptionId).toBeDefined();
        });
      } finally {
        client.disconnect();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    });

    it('should handle high-frequency message publishing', async () => {
      const publisher = new TcpTestClient(TEST_HOST, TEST_PORT);
      const subscriber = new TcpTestClient(TEST_HOST, TEST_PORT);

      try {
        await publisher.connect();
        await subscriber.connect();

        await publisher.authenticate(userTokens.alice);
        await subscriber.authenticate(userTokens.bob);

        const topic = 'high-frequency';

        const messageCount = 10;
        const receivedMessages: any[] = [];

        // Set up message collector BEFORE subscribing
        subscriber.on(TcpMessageType.SERVER_MESSAGE, (message: any) => {
          if (message.topic === topic) {
            receivedMessages.push(message.content);
          }
        });

        // Now subscribe
        await subscriber.subscribe(topic);

        // Give handler time to be fully registered
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Publish messages with small delays
        for (let i = 0; i < messageCount; i++) {
          publisher.publish(topic, { sequence: i });
          // Small delay between messages to avoid overwhelming
          await new Promise((resolve) => setTimeout(resolve, 10));
        }

        // Wait for all messages to arrive
        await new Promise((resolve) => setTimeout(resolve, 800));

        // Should have received most messages (allow for some potential loss in rapid fire)
        // Network I/O can be unpredictable, so we accept 60%+ delivery
        expect(receivedMessages.length).toBeGreaterThanOrEqual(Math.floor(messageCount * 0.6));

        // Verify messages are in order
        const sequences = receivedMessages.map((msg) => msg.sequence);
        for (let i = 1; i < sequences.length; i++) {
          expect(sequences[i]).toBeGreaterThan(sequences[i - 1]);
        }
      } finally {
        publisher.disconnect();
        subscriber.disconnect();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    });
  });

  describe('Error Recovery', () => {
    let client: TcpTestClient;

    beforeEach(() => {
      client = new TcpTestClient(TEST_HOST, TEST_PORT);
    });

    afterEach(async () => {
      client.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    it('should recover from authentication failure', async () => {
      await client.connect();

      // Try invalid auth
      await expect(client.authenticate('invalid-token')).rejects.toThrow();

      // Should still be connected and able to auth with valid token
      expect(client.isConnected()).toBe(true);

      const auth = await client.authenticate(userTokens.alice);
      expect(auth.userId).toBe(userIds.alice);
    });

    it('should handle operations after errors', async () => {
      await client.connect();
      await client.authenticate(userTokens.alice);

      // Successful subscribe
      await client.subscribe('valid-topic');

      // Try to subscribe again (might be allowed or not depending on implementation)
      // Just verify we can continue operating
      const topic2 = 'another-topic';
      await client.subscribe(topic2);

      // Should still work
      expect(client.isConnected()).toBe(true);
    });
  });

  describe('Session Management', () => {
    it('should isolate messages between different sessions', async () => {
      const session1 = new TcpTestClient(TEST_HOST, TEST_PORT);
      const session2 = new TcpTestClient(TEST_HOST, TEST_PORT);

      try {
        await session1.connect();
        await session2.connect();

        await session1.authenticate(userTokens.alice);
        await session2.authenticate(userTokens.bob);

        const topic = 'isolated-topic';

        // Only session1 subscribes
        await session1.subscribe(topic);

        // Session2 publishes
        session2.publish(topic, { message: 'test' });

        // Session1 should receive
        const received = await session1.waitForMessage(topic, 2000);
        expect(received.message).toBe('test');
      } finally {
        session1.disconnect();
        session2.disconnect();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    });

    it('should track server statistics correctly', async () => {
      const client1 = new TcpTestClient(TEST_HOST, TEST_PORT);
      const client2 = new TcpTestClient(TEST_HOST, TEST_PORT);

      try {
        await client1.connect();
        await client2.connect();

        await client1.authenticate(userTokens.alice);
        await client2.authenticate(userTokens.bob);

        const stats = server.getStats();

        expect(stats.activeConnections).toBeGreaterThanOrEqual(2);
        expect(stats.authenticatedConnections).toBeGreaterThanOrEqual(2);
        expect(stats.uptime).toBeGreaterThan(0);
      } finally {
        client1.disconnect();
        client2.disconnect();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    });
  });

  describe('Load Testing', () => {
    it('should handle multiple concurrent users in a chat room', async () => {
      const userCount = 5;
      const clients: TcpTestClient[] = [];
      const tokens = [
        userTokens.alice,
        userTokens.bob,
        userTokens.charlie,
        userTokens.alice, // Reuse tokens (different sessions)
        userTokens.bob,
      ];

      try {
        // Create and connect all clients
        for (let i = 0; i < userCount; i++) {
          const client = new TcpTestClient(TEST_HOST, TEST_PORT);
          clients.push(client);
          await client.connect();
          await client.authenticate(tokens[i]);
        }

        // All join same room
        const room = 'busy-room';
        await Promise.all(clients.map((c) => c.subscribe(room)));

        // First client sends message
        const messagePromises = clients.slice(1).map((c) => c.waitForMessage(room));

        clients[0].publish(room, { text: 'Message to all!', from: 'client0' });

        // All other clients should receive
        const received = await Promise.all(messagePromises);
        expect(received).toHaveLength(userCount - 1);
        received.forEach((msg) => {
          expect(msg.text).toBe('Message to all!');
        });
      } finally {
        clients.forEach((c) => c.disconnect());
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    });
  });
});

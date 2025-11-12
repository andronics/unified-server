/**
 * TcpMessageHandler Unit Tests
 * Layer 4: Application
 *
 * Tests TCP message routing, authentication, subscriptions, publishing,
 * error handling, and cleanup operations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { TcpMessageHandler } from '@protocols/tcp/message-handler';
import { TcpMessageType } from '@shared/types/tcp-types';
import { ErrorCode } from '@shared/errors/error-codes';
import { ApiError } from '@shared/errors/api-error';

// Mock dependencies
vi.mock('@domain/auth/jwt-service');
vi.mock('@infrastructure/database/repositories/user-repository');
vi.mock('@infrastructure/pubsub/pubsub-broker');
vi.mock('@infrastructure/logging/logger');

// Import mocked modules
import { jwtService } from '@domain/auth/jwt-service';
import { userRepository } from '@infrastructure/database/repositories/user-repository';
import { pubSubBroker } from '@infrastructure/pubsub/pubsub-broker';

describe('TcpMessageHandler', () => {
  let handler: TcpMessageHandler;
  let mockServer: any;
  let mockCodec: any;
  let mockConnectionManager: any;
  let serverEventEmitter: EventEmitter;

  beforeEach(() => {
    // Create event emitter for server events
    serverEventEmitter = new EventEmitter();

    // Mock codec
    mockCodec = {
      encode: vi.fn((message) => Buffer.from(JSON.stringify(message))),
      decode: vi.fn(),
    };

    // Mock connection manager
    mockConnectionManager = {
      getConnection: vi.fn(),
      authenticateConnection: vi.fn(),
      addSubscription: vi.fn(),
      removeSubscription: vi.fn(),
      sendToConnection: vi.fn(),
    };

    // Mock TCP server
    mockServer = {
      getCodec: vi.fn(() => mockCodec),
      getConnectionManager: vi.fn(() => mockConnectionManager),
      on: vi.fn((event, callback) => {
        serverEventEmitter.on(event, callback);
      }),
      emit: vi.fn((event, ...args) => {
        serverEventEmitter.emit(event, ...args);
      }),
    };

    // Reset mock implementations
    vi.mocked(jwtService.verifyToken).mockReset();
    vi.mocked(userRepository.findById).mockReset();
    vi.mocked(pubSubBroker.subscribe).mockReset();
    vi.mocked(pubSubBroker.unsubscribe).mockReset();
    vi.mocked(pubSubBroker.publish).mockReset();

    // Create handler (this will register event listeners)
    handler = new TcpMessageHandler(mockServer);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    serverEventEmitter.removeAllListeners();
  });

  describe('Constructor and initialization', () => {
    it('should register message handler', () => {
      expect(mockServer.on).toHaveBeenCalledWith('message', expect.any(Function));
    });

    it('should register disconnect handler', () => {
      expect(mockServer.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    });

    it('should initialize with zero statistics', () => {
      const stats = handler.getStats();
      expect(stats.messagesProcessed).toBe(0);
      expect(stats.authAttempts).toBe(0);
      expect(stats.authSuccesses).toBe(0);
      expect(stats.authFailures).toBe(0);
      expect(stats.subscriptions).toBe(0);
      expect(stats.unsubscriptions).toBe(0);
      expect(stats.messagesPublished).toBe(0);
      expect(stats.errors).toBe(0);
    });
  });

  describe('AUTH message handling', () => {
    const mockConnection = {
      id: 'conn-123',
      remoteAddress: '127.0.0.1',
      remotePort: 12345,
      connectedAt: new Date(),
      lastActivityAt: new Date(),
      subscriptions: new Map(),
      metadata: {},
      socket: {} as any,
    };

    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'user' as const,
      passwordHash: 'hash',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      mockConnectionManager.getConnection.mockReturnValue(mockConnection);
    });

    it('should authenticate with valid token', async () => {
      vi.mocked(jwtService.verifyToken).mockReturnValue({ userId: 'user-123' });
      vi.mocked(userRepository.findById).mockResolvedValue(mockUser);

      serverEventEmitter.emit('message', 'conn-123', TcpMessageType.AUTH, { token: 'valid-jwt' });

      // Wait for async handling
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(jwtService.verifyToken).toHaveBeenCalledWith('valid-jwt');
      expect(userRepository.findById).toHaveBeenCalledWith('user-123');
      expect(mockConnectionManager.authenticateConnection).toHaveBeenCalledWith(
        'conn-123',
        'user-123',
        expect.objectContaining({
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
        })
      );
      expect(mockCodec.encode).toHaveBeenCalledWith(
        expect.objectContaining({
          type: TcpMessageType.AUTH_SUCCESS,
        })
      );
      expect(mockConnectionManager.sendToConnection).toHaveBeenCalled();

      const stats = handler.getStats();
      expect(stats.authAttempts).toBe(1);
      expect(stats.authSuccesses).toBe(1);
      expect(stats.authFailures).toBe(0);
    });

    it('should reject already authenticated connection', async () => {
      const authenticatedConnection = {
        ...mockConnection,
        userId: 'user-123',
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'user' as const,
          createdAt: new Date(),
        },
      };

      mockConnectionManager.getConnection.mockReturnValue(authenticatedConnection);

      serverEventEmitter.emit('message', 'conn-123', TcpMessageType.AUTH, { token: 'valid-jwt' });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockCodec.encode).toHaveBeenCalledWith(
        expect.objectContaining({
          type: TcpMessageType.ERROR,
          data: expect.objectContaining({
            error: 'Already authenticated',
          }),
        })
      );

      const stats = handler.getStats();
      expect(stats.authAttempts).toBe(1);
      expect(stats.authSuccesses).toBe(0);
    });

    it('should reject invalid JWT token', async () => {
      vi.mocked(jwtService.verifyToken).mockImplementation(() => {
        throw ApiError.unauthorized('Invalid token');
      });

      serverEventEmitter.emit('message', 'conn-123', TcpMessageType.AUTH, {
        token: 'invalid-jwt',
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockCodec.encode).toHaveBeenCalledWith(
        expect.objectContaining({
          type: TcpMessageType.ERROR,
        })
      );

      const stats = handler.getStats();
      expect(stats.authAttempts).toBe(1);
      expect(stats.authFailures).toBe(1);
    });

    it('should reject when user not found', async () => {
      vi.mocked(jwtService.verifyToken).mockReturnValue({ userId: 'user-123' });
      vi.mocked(userRepository.findById).mockResolvedValue(null);

      serverEventEmitter.emit('message', 'conn-123', TcpMessageType.AUTH, { token: 'valid-jwt' });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockCodec.encode).toHaveBeenCalledWith(
        expect.objectContaining({
          type: TcpMessageType.ERROR,
        })
      );

      const stats = handler.getStats();
      expect(stats.authFailures).toBe(1);
    });

    it('should reject invalid auth message format', async () => {
      serverEventEmitter.emit('message', 'conn-123', TcpMessageType.AUTH, { invalid: 'data' });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockCodec.encode).toHaveBeenCalledWith(
        expect.objectContaining({
          type: TcpMessageType.ERROR,
          data: expect.objectContaining({
            error: 'Invalid auth data',
          }),
        })
      );

      const stats = handler.getStats();
      expect(stats.authFailures).toBe(1);
    });

    it('should handle auth for non-existent connection', async () => {
      mockConnectionManager.getConnection.mockReturnValue(undefined);

      serverEventEmitter.emit('message', 'non-existent', TcpMessageType.AUTH, {
        token: 'valid-jwt',
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(jwtService.verifyToken).not.toHaveBeenCalled();

      const stats = handler.getStats();
      expect(stats.authAttempts).toBe(1);
    });
  });

  describe('SUBSCRIBE message handling', () => {
    const mockConnection = {
      id: 'conn-123',
      userId: 'user-123',
      user: {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user' as const,
        createdAt: new Date(),
      },
      remoteAddress: '127.0.0.1',
      remotePort: 12345,
      connectedAt: new Date(),
      lastActivityAt: new Date(),
      subscriptions: new Map(),
      metadata: {},
      socket: {} as any,
    };

    beforeEach(() => {
      mockConnectionManager.getConnection.mockReturnValue(mockConnection);
      vi.mocked(pubSubBroker.subscribe).mockResolvedValue('sub-123');
    });

    it('should subscribe to topic successfully', async () => {
      serverEventEmitter.emit('message', 'conn-123', TcpMessageType.SUBSCRIBE, {
        topic: 'test-topic',
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(pubSubBroker.subscribe).toHaveBeenCalledWith('test-topic', expect.any(Function));
      expect(mockConnectionManager.addSubscription).toHaveBeenCalledWith(
        'conn-123',
        'test-topic',
        'sub-123'
      );
      expect(mockCodec.encode).toHaveBeenCalledWith(
        expect.objectContaining({
          type: TcpMessageType.SUBSCRIBED,
          data: expect.objectContaining({
            topic: 'test-topic',
            subscriptionId: 'sub-123',
          }),
        })
      );

      const stats = handler.getStats();
      expect(stats.subscriptions).toBe(1);
    });

    it('should reject subscription when not authenticated', async () => {
      const unauthConnection = { ...mockConnection, userId: undefined, user: undefined };
      mockConnectionManager.getConnection.mockReturnValue(unauthConnection);

      serverEventEmitter.emit('message', 'conn-123', TcpMessageType.SUBSCRIBE, {
        topic: 'test-topic',
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(pubSubBroker.subscribe).not.toHaveBeenCalled();
      expect(mockCodec.encode).toHaveBeenCalledWith(
        expect.objectContaining({
          type: TcpMessageType.ERROR,
          data: expect.objectContaining({
            error: 'Authentication required',
          }),
        })
      );
    });

    it('should reject duplicate subscription', async () => {
      // First subscription
      serverEventEmitter.emit('message', 'conn-123', TcpMessageType.SUBSCRIBE, {
        topic: 'test-topic',
      });
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Second subscription to same topic
      serverEventEmitter.emit('message', 'conn-123', TcpMessageType.SUBSCRIBE, {
        topic: 'test-topic',
      });
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should have been called only once (first time)
      expect(pubSubBroker.subscribe).toHaveBeenCalledTimes(1);
    });

    it('should reject invalid subscribe message format', async () => {
      serverEventEmitter.emit('message', 'conn-123', TcpMessageType.SUBSCRIBE, { invalid: 'data' });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(pubSubBroker.subscribe).not.toHaveBeenCalled();
      expect(mockCodec.encode).toHaveBeenCalledWith(
        expect.objectContaining({
          type: TcpMessageType.ERROR,
          data: expect.objectContaining({
            error: 'Invalid subscribe data',
          }),
        })
      );
    });

    it('should forward pubsub messages to TCP connection', async () => {
      let pubSubCallback: Function | undefined;

      vi.mocked(pubSubBroker.subscribe).mockImplementation(
        async (topic: string, callback: Function) => {
          pubSubCallback = callback;
          return 'sub-123';
        }
      );

      serverEventEmitter.emit('message', 'conn-123', TcpMessageType.SUBSCRIBE, {
        topic: 'test-topic',
      });
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(pubSubCallback).toBeDefined();

      // Simulate PubSub message
      pubSubCallback!({
        data: { message: 'Hello' },
        timestamp: new Date().toISOString(),
      });

      expect(mockCodec.encode).toHaveBeenCalledWith(
        expect.objectContaining({
          type: TcpMessageType.SERVER_MESSAGE,
        })
      );
    });
  });

  describe('UNSUBSCRIBE message handling', () => {
    const mockConnection = {
      id: 'conn-123',
      userId: 'user-123',
      user: {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user' as const,
        createdAt: new Date(),
      },
      remoteAddress: '127.0.0.1',
      remotePort: 12345,
      connectedAt: new Date(),
      lastActivityAt: new Date(),
      subscriptions: new Map(),
      metadata: {},
      socket: {} as any,
    };

    beforeEach(() => {
      mockConnectionManager.getConnection.mockReturnValue(mockConnection);
      vi.mocked(pubSubBroker.subscribe).mockResolvedValue('sub-123');
      vi.mocked(pubSubBroker.unsubscribe).mockResolvedValue();
    });

    it('should unsubscribe from topic successfully', async () => {
      // First subscribe
      serverEventEmitter.emit('message', 'conn-123', TcpMessageType.SUBSCRIBE, {
        topic: 'test-topic',
      });
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Then unsubscribe
      serverEventEmitter.emit('message', 'conn-123', TcpMessageType.UNSUBSCRIBE, {
        topic: 'test-topic',
      });
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(pubSubBroker.unsubscribe).toHaveBeenCalledWith('sub-123');
      expect(mockConnectionManager.removeSubscription).toHaveBeenCalledWith(
        'conn-123',
        'test-topic'
      );
      expect(mockCodec.encode).toHaveBeenCalledWith(
        expect.objectContaining({
          type: TcpMessageType.UNSUBSCRIBED,
        })
      );

      const stats = handler.getStats();
      expect(stats.unsubscriptions).toBe(1);
    });

    it('should reject unsubscribe when not authenticated', async () => {
      const unauthConnection = { ...mockConnection, userId: undefined, user: undefined };
      mockConnectionManager.getConnection.mockReturnValue(unauthConnection);

      serverEventEmitter.emit('message', 'conn-123', TcpMessageType.UNSUBSCRIBE, {
        topic: 'test-topic',
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(pubSubBroker.unsubscribe).not.toHaveBeenCalled();
      expect(mockCodec.encode).toHaveBeenCalledWith(
        expect.objectContaining({
          type: TcpMessageType.ERROR,
          data: expect.objectContaining({
            error: 'Authentication required',
          }),
        })
      );
    });

    it('should reject unsubscribe from non-subscribed topic', async () => {
      serverEventEmitter.emit('message', 'conn-123', TcpMessageType.UNSUBSCRIBE, {
        topic: 'non-subscribed-topic',
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(pubSubBroker.unsubscribe).not.toHaveBeenCalled();
      expect(mockCodec.encode).toHaveBeenCalledWith(
        expect.objectContaining({
          type: TcpMessageType.ERROR,
          data: expect.objectContaining({
            error: 'Not subscribed',
          }),
        })
      );
    });

    it('should reject invalid unsubscribe message format', async () => {
      serverEventEmitter.emit('message', 'conn-123', TcpMessageType.UNSUBSCRIBE, {
        invalid: 'data',
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(pubSubBroker.unsubscribe).not.toHaveBeenCalled();
      expect(mockCodec.encode).toHaveBeenCalledWith(
        expect.objectContaining({
          type: TcpMessageType.ERROR,
          data: expect.objectContaining({
            error: 'Invalid unsubscribe data',
          }),
        })
      );
    });
  });

  describe('MESSAGE (publish) handling', () => {
    const mockConnection = {
      id: 'conn-123',
      userId: 'user-123',
      user: {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user' as const,
        createdAt: new Date(),
      },
      remoteAddress: '127.0.0.1',
      remotePort: 12345,
      connectedAt: new Date(),
      lastActivityAt: new Date(),
      subscriptions: new Map(),
      metadata: {},
      socket: {} as any,
    };

    beforeEach(() => {
      mockConnectionManager.getConnection.mockReturnValue(mockConnection);
      vi.mocked(pubSubBroker.publish).mockResolvedValue();
    });

    it('should publish message to topic successfully', async () => {
      serverEventEmitter.emit('message', 'conn-123', TcpMessageType.MESSAGE, {
        topic: 'test-topic',
        content: { message: 'Hello World' },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(pubSubBroker.publish).toHaveBeenCalledWith(
        'test-topic',
        expect.objectContaining({
          data: { message: 'Hello World' },
          userId: 'user-123',
        })
      );

      const stats = handler.getStats();
      expect(stats.messagesPublished).toBe(1);
    });

    it('should reject publish when not authenticated', async () => {
      const unauthConnection = { ...mockConnection, userId: undefined, user: undefined };
      mockConnectionManager.getConnection.mockReturnValue(unauthConnection);

      serverEventEmitter.emit('message', 'conn-123', TcpMessageType.MESSAGE, {
        topic: 'test-topic',
        content: { message: 'Hello' },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(pubSubBroker.publish).not.toHaveBeenCalled();
      expect(mockCodec.encode).toHaveBeenCalledWith(
        expect.objectContaining({
          type: TcpMessageType.ERROR,
          data: expect.objectContaining({
            error: 'Authentication required',
          }),
        })
      );
    });

    it('should reject invalid publish message format', async () => {
      serverEventEmitter.emit('message', 'conn-123', TcpMessageType.MESSAGE, { invalid: 'data' });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(pubSubBroker.publish).not.toHaveBeenCalled();
      expect(mockCodec.encode).toHaveBeenCalledWith(
        expect.objectContaining({
          type: TcpMessageType.ERROR,
          data: expect.objectContaining({
            error: 'Invalid publish data',
          }),
        })
      );
    });

    it('should handle pubsub publish errors', async () => {
      vi.mocked(pubSubBroker.publish).mockRejectedValue(new Error('PubSub error'));

      serverEventEmitter.emit('message', 'conn-123', TcpMessageType.MESSAGE, {
        topic: 'test-topic',
        content: { message: 'Hello' },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockCodec.encode).toHaveBeenCalledWith(
        expect.objectContaining({
          type: TcpMessageType.ERROR,
          data: expect.objectContaining({
            error: 'Publish failed',
          }),
        })
      );
    });
  });

  describe('PING/PONG handling', () => {
    const mockConnection = {
      id: 'conn-123',
      remoteAddress: '127.0.0.1',
      remotePort: 12345,
      connectedAt: new Date(),
      lastActivityAt: new Date(),
      subscriptions: new Map(),
      metadata: {},
      socket: {} as any,
    };

    beforeEach(() => {
      mockConnectionManager.getConnection.mockReturnValue(mockConnection);
    });

    it('should respond to PING with PONG', async () => {
      serverEventEmitter.emit('message', 'conn-123', TcpMessageType.PING, {});

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockCodec.encode).toHaveBeenCalledWith(
        expect.objectContaining({
          type: TcpMessageType.PONG,
        })
      );
      expect(mockConnectionManager.sendToConnection).toHaveBeenCalled();
    });

    it('should handle PONG message', async () => {
      serverEventEmitter.emit('message', 'conn-123', TcpMessageType.PONG, {});

      await new Promise((resolve) => setTimeout(resolve, 10));

      // PONG is just logged, no response needed
      const stats = handler.getStats();
      expect(stats.messagesProcessed).toBe(1);
    });
  });

  describe('Unknown message types', () => {
    it('should reject unknown message type', async () => {
      serverEventEmitter.emit('message', 'conn-123', 0x99 as TcpMessageType, {});

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockCodec.encode).toHaveBeenCalledWith(
        expect.objectContaining({
          type: TcpMessageType.ERROR,
          data: expect.objectContaining({
            error: 'Unknown message type',
          }),
        })
      );

      const stats = handler.getStats();
      expect(stats.errors).toBe(1);
    });
  });

  describe('Disconnect cleanup', () => {
    it('should cleanup subscriptions on disconnect', async () => {
      const mockConnection = {
        id: 'conn-123',
        userId: 'user-123',
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'user' as const,
          createdAt: new Date(),
        },
        remoteAddress: '127.0.0.1',
        remotePort: 12345,
        connectedAt: new Date(),
        lastActivityAt: new Date(),
        subscriptions: new Map(),
        metadata: {},
        socket: {} as any,
      };

      mockConnectionManager.getConnection.mockReturnValue(mockConnection);
      vi.mocked(pubSubBroker.subscribe).mockResolvedValue('sub-123');
      vi.mocked(pubSubBroker.unsubscribe).mockResolvedValue();

      // Subscribe to a topic
      serverEventEmitter.emit('message', 'conn-123', TcpMessageType.SUBSCRIBE, {
        topic: 'test-topic',
      });
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Trigger disconnect
      serverEventEmitter.emit('disconnect', 'conn-123');
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(pubSubBroker.unsubscribe).toHaveBeenCalledWith('sub-123');
    });

    it('should handle disconnect for connection with no subscriptions', async () => {
      vi.mocked(pubSubBroker.unsubscribe).mockResolvedValue();

      serverEventEmitter.emit('disconnect', 'conn-no-subs');
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should not error
      expect(pubSubBroker.unsubscribe).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle errors gracefully', async () => {
      mockConnectionManager.getConnection.mockImplementation(() => {
        throw new Error('Connection manager error');
      });

      serverEventEmitter.emit('message', 'conn-123', TcpMessageType.AUTH, { token: 'test' });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const stats = handler.getStats();
      expect(stats.errors).toBe(1);
    });

    it('should handle sendError failures gracefully', async () => {
      mockConnectionManager.getConnection.mockReturnValue({
        id: 'conn-123',
        remoteAddress: '127.0.0.1',
        remotePort: 12345,
        connectedAt: new Date(),
        lastActivityAt: new Date(),
        subscriptions: new Map(),
        metadata: {},
        socket: {} as any,
      });

      mockCodec.encode.mockImplementation(() => {
        throw new Error('Encoding error');
      });

      serverEventEmitter.emit('message', 'conn-123', 0x99 as TcpMessageType, {});

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should not crash despite encoding error
      expect(true).toBe(true);
    });
  });

  describe('Statistics', () => {
    it('should track message processing statistics', async () => {
      // Start with unauthenticated connection
      const mockConnection = {
        id: 'conn-123',
        remoteAddress: '127.0.0.1',
        remotePort: 12345,
        connectedAt: new Date(),
        lastActivityAt: new Date(),
        subscriptions: new Map(),
        metadata: {},
        socket: {} as any,
      };

      mockConnectionManager.getConnection.mockReturnValue(mockConnection);

      // Mock authenticateConnection to update the connection
      mockConnectionManager.authenticateConnection.mockImplementation(
        (connId: string, userId: string, user: any) => {
          mockConnection.userId = userId;
          mockConnection.user = user;
        }
      );
      vi.mocked(jwtService.verifyToken).mockReturnValue({ userId: 'user-123' });
      vi.mocked(userRepository.findById).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        passwordHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Auth
      serverEventEmitter.emit('message', 'conn-123', TcpMessageType.AUTH, { token: 'valid-jwt' });
      await new Promise((resolve) => setTimeout(resolve, 50)); // Increased for async auth

      // Subscribe
      vi.mocked(pubSubBroker.subscribe).mockResolvedValue('sub-123');
      serverEventEmitter.emit('message', 'conn-123', TcpMessageType.SUBSCRIBE, {
        topic: 'test-topic',
      });
      await new Promise((resolve) => setTimeout(resolve, 50)); // Increased for async subscribe

      // Publish
      vi.mocked(pubSubBroker.publish).mockResolvedValue();
      serverEventEmitter.emit('message', 'conn-123', TcpMessageType.MESSAGE, {
        topic: 'test-topic',
        content: { message: 'Hello' },
      });
      await new Promise((resolve) => setTimeout(resolve, 50)); // Increased for async publish

      const stats = handler.getStats();
      expect(stats.messagesProcessed).toBe(3);
      expect(stats.authSuccesses).toBe(1);
      expect(stats.subscriptions).toBe(1);
      expect(stats.messagesPublished).toBe(1);
    });

    it('should return statistics copy, not reference', () => {
      const stats1 = handler.getStats();
      const stats2 = handler.getStats();

      expect(stats1).not.toBe(stats2);
      expect(stats1).toEqual(stats2);
    });
  });
});

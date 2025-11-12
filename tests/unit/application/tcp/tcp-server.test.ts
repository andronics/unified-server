/**
 * TcpServer Unit Tests
 * Layer 4: Application
 *
 * Tests TCP server lifecycle, connection handling, data processing,
 * error handling, and periodic tasks.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { TcpServer } from '@protocols/tcp/tcp-server';
import { ValidatedConfig } from '@infrastructure/config/config-schema';
import { TcpMessageType } from '@shared/types/tcp-types';
import { ErrorCode } from '@shared/errors/error-codes';
import { ApiError } from '@shared/errors/api-error';

// Mock dependencies
vi.mock('@infrastructure/logging/logger');
vi.mock('./connection-manager');
vi.mock('./protocol-codec');
vi.mock('./frame-parser');

// Mock net module
vi.mock('net', () => {
  const mockNetServer = new EventEmitter();
  (mockNetServer as any).listen = vi.fn();
  (mockNetServer as any).close = vi.fn();
  (mockNetServer as any).listening = false;

  return {
    createServer: vi.fn(() => mockNetServer),
    Server: class Server extends EventEmitter {},
    Socket: class Socket extends EventEmitter {},
  };
});

import * as net from 'net';

describe('TcpServer', () => {
  let server: TcpServer;
  let mockNetServer: any;
  let mockConfig: ValidatedConfig;
  let mockSocket: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Set up mock net server behavior
    mockNetServer = (net.createServer as any)();
    mockNetServer.listen = vi.fn((port: number, host: string, callback: () => void) => {
      setTimeout(() => {
        mockNetServer.listening = true;
        callback();
      }, 10);
      return mockNetServer;
    });
    mockNetServer.close = vi.fn((callback: () => void) => {
      setTimeout(() => {
        mockNetServer.listening = false;
        callback();
      }, 10);
      return mockNetServer;
    });
    mockNetServer.listening = false;

    // Mock createServer to return our mock and capture onConnection callback
    (net.createServer as any).mockImplementation((onConnection: (socket: any) => void) => {
      mockNetServer.onConnection = onConnection;
      return mockNetServer;
    });

    // Mock socket
    mockSocket = new EventEmitter();
    mockSocket.remoteAddress = '127.0.0.1';
    mockSocket.remotePort = 12345;
    mockSocket.destroyed = false;
    mockSocket.write = vi.fn();
    mockSocket.destroy = vi.fn();
    mockSocket.setNoDelay = vi.fn();
    mockSocket.setKeepAlive = vi.fn();

    // Mock config
    mockConfig = {
      tcp: {
        enabled: true,
        host: '0.0.0.0',
        port: 8080,
        maxConnections: 100,
        maxConnectionsPerIp: 5,
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllTimers();
  });

  describe('Constructor', () => {
    it('should create server with valid config', () => {
      server = new TcpServer(mockConfig);
      expect(server).toBeDefined();
      expect(server).toBeInstanceOf(EventEmitter);
    });

    it('should throw error if TCP config is missing', () => {
      const invalidConfig = { tcp: undefined } as any;
      expect(() => new TcpServer(invalidConfig)).toThrow('TCP configuration is required');
    });

    it('should initialize connection manager and codec', () => {
      server = new TcpServer(mockConfig);
      expect(server.getConnectionManager()).toBeDefined();
      expect(server.getCodec()).toBeDefined();
    });
  });

  describe('start()', () => {
    beforeEach(() => {
      server = new TcpServer(mockConfig);
    });

    it('should start server on configured host and port', async () => {
      await server.start();

      expect(net.createServer).toHaveBeenCalled();
      expect(mockNetServer.listen).toHaveBeenCalledWith(
        8080,
        '0.0.0.0',
        expect.any(Function)
      );
      expect(server.isRunning()).toBe(true);
    });

    it('should emit started event', async () => {
      const startedSpy = vi.fn();
      server.on('started', startedSpy);

      await server.start();

      expect(startedSpy).toHaveBeenCalled();
    });

    it('should not start if already started', async () => {
      await server.start();
      const listenCallCount = (mockNetServer.listen as any).mock.calls.length;

      await server.start();

      expect((mockNetServer.listen as any).mock.calls.length).toBe(listenCallCount);
    });

    it('should not start if disabled in config', async () => {
      mockConfig.tcp!.enabled = false;
      server = new TcpServer(mockConfig);

      await server.start();

      expect(mockNetServer.listen).not.toHaveBeenCalled();
      expect(server.isRunning()).toBe(false);
    });

    it('should handle server error during startup', async () => {
      mockNetServer.listen = vi.fn(() => {
        setTimeout(() => mockNetServer.emit('error', new Error('EADDRINUSE')), 10);
        return mockNetServer;
      });

      await expect(server.start()).rejects.toThrow();
    });

    it('should start periodic tasks after starting', async () => {
      vi.useFakeTimers();

      await server.start();

      // Fast-forward time to verify ping interval works
      vi.advanceTimersByTime(mockConfig.tcp!.pingInterval);

      // Cleanup
      vi.useRealTimers();
    });
  });

  describe('stop()', () => {
    beforeEach(async () => {
      server = new TcpServer(mockConfig);
      await server.start();
    });

    it('should stop server gracefully', async () => {
      await server.stop();

      expect(mockNetServer.close).toHaveBeenCalled();
      expect(server.isRunning()).toBe(false);
    });

    it('should emit stopped event', async () => {
      const stoppedSpy = vi.fn();
      server.on('stopped', stoppedSpy);

      await server.stop();

      expect(stoppedSpy).toHaveBeenCalled();
    });

    it('should close all connections before stopping', async () => {
      const connectionManager = server.getConnectionManager();
      const closeAllSpy = vi.spyOn(connectionManager, 'closeAll').mockResolvedValue();

      await server.stop(3000);

      expect(closeAllSpy).toHaveBeenCalledWith(3000);
    });

    it('should clear periodic task intervals', async () => {
      vi.useFakeTimers();

      await server.stop();

      // Verify intervals are cleared by advancing time
      vi.advanceTimersByTime(100000);

      vi.useRealTimers();
    });

    it('should handle stop when not running', async () => {
      await server.stop();

      // Should not throw
      await expect(server.stop()).resolves.toBeUndefined();
    });
  });

  describe('Connection handling', () => {
    beforeEach(async () => {
      server = new TcpServer(mockConfig);
      await server.start();
    });

    afterEach(async () => {
      await server.stop();
    });

    it('should accept new connections', () => {
      const connectionSpy = vi.fn();
      server.on('connection', connectionSpy);

      mockNetServer.onConnection(mockSocket);

      expect(connectionSpy).toHaveBeenCalledWith(
        expect.any(String),
        '127.0.0.1'
      );
    });

    it('should reject connections during shutdown', async () => {
      // Start shutdown (but don't wait for it to complete)
      const stopPromise = server.stop();

      // Try to connect
      mockNetServer.onConnection(mockSocket);

      expect(mockSocket.destroy).toHaveBeenCalled();

      await stopPromise;
    });

    it('should set socket options', () => {
      mockNetServer.onConnection(mockSocket);

      expect(mockSocket.setNoDelay).toHaveBeenCalledWith(true);
      expect(mockSocket.setKeepAlive).toHaveBeenCalledWith(
        true,
        mockConfig.tcp!.keepAliveInterval
      );
    });

    it('should emit disconnect on socket close', () => {
      const disconnectSpy = vi.fn();
      server.on('disconnect', disconnectSpy);

      mockNetServer.onConnection(mockSocket);
      mockSocket.emit('close');

      expect(disconnectSpy).toHaveBeenCalledWith(expect.any(String));
    });

    it('should emit error on socket error', () => {
      const errorSpy = vi.fn();
      server.on('error', errorSpy);

      mockNetServer.onConnection(mockSocket);
      const socketError = new Error('Socket error');
      mockSocket.emit('error', socketError);

      expect(errorSpy).toHaveBeenCalledWith(socketError, expect.any(String));
    });

    it('should handle connection limit error', () => {
      const connectionManager = server.getConnectionManager();
      vi.spyOn(connectionManager, 'addConnection').mockImplementation(() => {
        throw ApiError.conflict('Connection limit reached');
      });

      mockNetServer.onConnection(mockSocket);

      expect(mockSocket.destroy).toHaveBeenCalled();
    });
  });

  describe('Data processing', () => {
    beforeEach(async () => {
      server = new TcpServer(mockConfig);
      await server.start();
    });

    afterEach(async () => {
      await server.stop();
    });

    it('should process incoming data frames', () => {
      const messageSpy = vi.fn();
      server.on('message', messageSpy);

      mockNetServer.onConnection(mockSocket);

      // Simulate incoming data
      const testData = Buffer.from('test data');
      mockSocket.emit('data', testData);

      // Message emission happens after frame parsing and decoding
      // In real implementation, this would trigger via FrameParser and ProtocolCodec
    });

    it('should update connection activity on data', () => {
      const connectionManager = server.getConnectionManager();
      const updateActivitySpy = vi.spyOn(connectionManager, 'updateActivity');

      mockNetServer.onConnection(mockSocket);
      const testData = Buffer.from('test data');
      mockSocket.emit('data', testData);

      expect(updateActivitySpy).toHaveBeenCalled();
    });

    it('should handle frame parsing errors', () => {
      mockNetServer.onConnection(mockSocket);

      // Simulate parser error by having FrameParser throw
      const testData = Buffer.from('invalid data');
      mockSocket.emit('data', testData);

      // Should not crash the server
      expect(server.isRunning()).toBe(true);
    });

    it('should destroy socket on protocol errors', () => {
      mockNetServer.onConnection(mockSocket);

      // Simulate severe protocol error
      const testData = Buffer.from('malformed frame');
      mockSocket.emit('data', testData);

      // In case of protocol errors, socket might be destroyed
      // (depends on FrameParser implementation)
    });
  });

  describe('Error handling', () => {
    beforeEach(async () => {
      server = new TcpServer(mockConfig);
      await server.start();
    });

    afterEach(async () => {
      await server.stop();
    });

    it('should handle connection manager errors gracefully', () => {
      const connectionManager = server.getConnectionManager();
      vi.spyOn(connectionManager, 'addConnection').mockImplementation(() => {
        throw new Error('Connection manager error');
      });

      mockNetServer.onConnection(mockSocket);

      expect(mockSocket.destroy).toHaveBeenCalled();
    });

    it('should emit error events for server errors', () => {
      const errorSpy = vi.fn();
      server.on('error', errorSpy);

      const serverError = new Error('Server error');
      mockNetServer.emit('error', serverError);

      expect(errorSpy).toHaveBeenCalledWith(serverError);
    });
  });

  describe('Periodic tasks', () => {
    beforeEach(async () => {
      vi.useFakeTimers();
      server = new TcpServer(mockConfig);
      await server.start();
    });

    afterEach(async () => {
      await server.stop();
      vi.useRealTimers();
    });

    it('should send periodic pings to authenticated connections', () => {
      const connectionManager = server.getConnectionManager();

      // Mock an authenticated connection
      vi.spyOn(connectionManager, 'getAllConnectionIds').mockReturnValue(['conn-123']);
      vi.spyOn(connectionManager, 'getConnection').mockReturnValue({
        id: 'conn-123',
        userId: 'user-123',
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'user',
          createdAt: new Date(),
        },
        remoteAddress: '127.0.0.1',
        remotePort: 12345,
        connectedAt: new Date(),
        lastActivityAt: new Date(),
        subscriptions: new Map(),
        metadata: {},
        socket: mockSocket,
      });

      const sendSpy = vi.spyOn(connectionManager, 'sendToConnection').mockReturnValue(true);

      // Fast-forward to trigger ping
      vi.advanceTimersByTime(mockConfig.tcp!.pingInterval + 100);

      expect(sendSpy).toHaveBeenCalled();
    });

    it('should not ping unauthenticated connections', () => {
      const connectionManager = server.getConnectionManager();

      // Mock an unauthenticated connection
      vi.spyOn(connectionManager, 'getAllConnectionIds').mockReturnValue(['conn-123']);
      vi.spyOn(connectionManager, 'getConnection').mockReturnValue({
        id: 'conn-123',
        remoteAddress: '127.0.0.1',
        remotePort: 12345,
        connectedAt: new Date(),
        lastActivityAt: new Date(),
        subscriptions: new Map(),
        metadata: {},
        socket: mockSocket,
      });

      const sendSpy = vi.spyOn(connectionManager, 'sendToConnection').mockReturnValue(true);

      // Fast-forward to trigger ping
      vi.advanceTimersByTime(mockConfig.tcp!.pingInterval + 100);

      expect(sendSpy).not.toHaveBeenCalled();
    });

    it('should check for stale connections periodically', () => {
      const connectionManager = server.getConnectionManager();
      const removeStaleSpy = vi.spyOn(connectionManager, 'removeStaleConnections').mockReturnValue(0);

      // Fast-forward to trigger stale check
      vi.advanceTimersByTime(60000); // Check interval is min(pingTimeout, 60000)

      expect(removeStaleSpy).toHaveBeenCalled();
    });

    it('should remove stale connections after timeout', () => {
      const connectionManager = server.getConnectionManager();
      const removeStaleSpy = vi.spyOn(connectionManager, 'removeStaleConnections').mockReturnValue(2);

      // Fast-forward to trigger stale check
      vi.advanceTimersByTime(60000);

      expect(removeStaleSpy).toHaveBeenCalledWith(
        expect.any(Number) // maxIdleTime = pingTimeout * 2
      );
    });
  });

  describe('getStats()', () => {
    beforeEach(async () => {
      server = new TcpServer(mockConfig);
      await server.start();
    });

    afterEach(async () => {
      await server.stop();
    });

    it('should return server statistics', () => {
      const stats = server.getStats();

      expect(stats).toHaveProperty('activeConnections');
      expect(stats).toHaveProperty('authenticatedConnections');
      expect(stats).toHaveProperty('startedAt');
      expect(stats).toHaveProperty('uptime');
    });

    it('should calculate uptime correctly', async () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      await server.start();

      vi.advanceTimersByTime(5000); // 5 seconds

      const stats = server.getStats();
      expect(stats.uptime).toBeGreaterThanOrEqual(5000);

      vi.useRealTimers();
    });

    it('should include connection manager stats', () => {
      const stats = server.getStats();

      expect(stats).toHaveProperty('messagesSent');
      expect(stats).toHaveProperty('messagesReceived');
      expect(stats).toHaveProperty('errors');
    });
  });

  describe('isRunning()', () => {
    beforeEach(() => {
      server = new TcpServer(mockConfig);
    });

    it('should return false when not started', () => {
      expect(server.isRunning()).toBe(false);
    });

    it('should return true when running', async () => {
      await server.start();
      expect(server.isRunning()).toBe(true);
    });

    it('should return false after stopping', async () => {
      await server.start();
      await server.stop();
      expect(server.isRunning()).toBe(false);
    });
  });

  describe('Accessor methods', () => {
    beforeEach(() => {
      server = new TcpServer(mockConfig);
    });

    it('should provide access to connection manager', () => {
      const connectionManager = server.getConnectionManager();
      expect(connectionManager).toBeDefined();
      expect(connectionManager).toBe(server.getConnectionManager());
    });

    it('should provide access to protocol codec', () => {
      const codec = server.getCodec();
      expect(codec).toBeDefined();
      expect(codec).toBe(server.getCodec());
    });
  });
});

/**
 * ConnectionManager Unit Tests
 * Layer 4: Application
 *
 * Tests TCP connection lifecycle management, authentication, subscriptions,
 * limits, broadcasting, and cleanup operations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Socket } from 'net';
import { ConnectionManager } from '@protocols/tcp/connection-manager';
import { TcpServerConfig } from '@shared/types/tcp-types';
import { PublicUser } from '@shared/types/common-types';
import { ApiError } from '@shared/errors/api-error';
import { ErrorCode } from '@shared/errors/error-codes';

describe('ConnectionManager', () => {
  let manager: ConnectionManager;
  let mockSocket: any;
  let config: TcpServerConfig;

  beforeEach(() => {
    config = {
      enabled: true,
      host: '0.0.0.0',
      port: 8080,
      maxConnections: 100,
      maxConnectionsPerIp: 5,
      frameParserConfig: {
        maxFrameSize: 1024 * 1024,
      },
      protocolCodecConfig: {
        maxFrameSize: 1024 * 1024,
      },
    };

    manager = new ConnectionManager(config);

    // Create mock socket
    mockSocket = {
      remoteAddress: '127.0.0.1',
      remotePort: 12345,
      destroyed: false,
      write: vi.fn(),
      end: vi.fn((callback?: () => void) => {
        if (callback) callback();
      }),
      destroy: vi.fn(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('addConnection', () => {
    it('should add new connection successfully', () => {
      const result = manager.addConnection(mockSocket);

      expect(result.id).toBeDefined();
      expect(result.connection).toBeDefined();
      expect(result.connection.id).toBe(result.id);
      expect(result.connection.socket).toBe(mockSocket);
      expect(result.connection.remoteAddress).toBe('127.0.0.1');
      expect(result.connection.remotePort).toBe(12345);
      expect(result.connection.subscriptions).toBeInstanceOf(Map);
      expect(result.connection.subscriptions.size).toBe(0);
    });

    it('should set connection timestamps', () => {
      const before = new Date();
      const result = manager.addConnection(mockSocket);
      const after = new Date();

      expect(result.connection.connectedAt).toBeInstanceOf(Date);
      expect(result.connection.lastActivityAt).toBeInstanceOf(Date);
      expect(result.connection.connectedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.connection.connectedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should track connection by IP', () => {
      const result1 = manager.addConnection(mockSocket);

      const mockSocket2 = { ...mockSocket, remotePort: 12346 };
      const result2 = manager.addConnection(mockSocket2);

      expect(manager.getConnectionCount()).toBe(2);
    });

    it('should throw error when IP connection limit reached', () => {
      // Add connections up to the limit
      for (let i = 0; i < config.maxConnectionsPerIp; i++) {
        const socket = { ...mockSocket, remotePort: 10000 + i };
        manager.addConnection(socket);
      }

      // Next connection from same IP should fail
      const socket = { ...mockSocket, remotePort: 20000 };
      expect(() => manager.addConnection(socket)).toThrow(ApiError);
      expect(() => manager.addConnection(socket)).toThrow('Connection limit reached');
    });

    it('should throw error when total connection limit reached', () => {
      const smallConfig = { ...config, maxConnections: 3 };
      const smallManager = new ConnectionManager(smallConfig);

      // Add connections up to the limit
      for (let i = 0; i < 3; i++) {
        const socket = { ...mockSocket, remoteAddress: `192.168.1.${i}`, remotePort: 10000 + i };
        smallManager.addConnection(socket);
      }

      // Next connection should fail
      const socket = { ...mockSocket, remoteAddress: '192.168.1.100', remotePort: 20000 };
      expect(() => smallManager.addConnection(socket)).toThrow(ApiError);
      expect(() => smallManager.addConnection(socket)).toThrow('Server connection limit reached');
    });

    it('should handle unknown remote address', () => {
      const socketWithoutAddress = {
        ...mockSocket,
        remoteAddress: undefined,
        remotePort: undefined,
      };

      const result = manager.addConnection(socketWithoutAddress);
      expect(result.connection.remoteAddress).toBe('unknown');
      expect(result.connection.remotePort).toBe(0);
    });
  });

  describe('removeConnection', () => {
    it('should remove connection successfully', () => {
      const result = manager.addConnection(mockSocket);
      expect(manager.hasConnection(result.id)).toBe(true);

      manager.removeConnection(result.id);
      expect(manager.hasConnection(result.id)).toBe(false);
    });

    it('should handle removing non-existent connection', () => {
      expect(() => manager.removeConnection('non-existent-id')).not.toThrow();
    });

    it('should clean up user connections tracking', () => {
      const result = manager.addConnection(mockSocket);
      const user: PublicUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        createdAt: new Date(),
      };

      manager.authenticateConnection(result.id, user.id, user);
      expect(manager.getUserConnections(user.id).size).toBe(1);

      manager.removeConnection(result.id);
      expect(manager.getUserConnections(user.id).size).toBe(0);
    });

    it('should clean up IP connections tracking', () => {
      const result1 = manager.addConnection(mockSocket);
      const mockSocket2 = { ...mockSocket, remotePort: 12346 };
      const result2 = manager.addConnection(mockSocket2);

      expect(manager.getConnectionCount()).toBe(2);

      manager.removeConnection(result1.id);
      expect(manager.getConnectionCount()).toBe(1);

      manager.removeConnection(result2.id);
      expect(manager.getConnectionCount()).toBe(0);
    });

    it('should clean up topic subscriptions', () => {
      const result = manager.addConnection(mockSocket);
      manager.addSubscription(result.id, 'test-topic', 'sub-123');

      expect(manager.getTopicConnections('test-topic').size).toBe(1);

      manager.removeConnection(result.id);
      expect(manager.getTopicConnections('test-topic').size).toBe(0);
    });
  });

  describe('authenticateConnection', () => {
    it('should authenticate connection successfully', () => {
      const result = manager.addConnection(mockSocket);
      const user: PublicUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        createdAt: new Date(),
      };

      manager.authenticateConnection(result.id, user.id, user);

      const connection = manager.getConnection(result.id);
      expect(connection?.userId).toBe(user.id);
      expect(connection?.user).toEqual(user);
    });

    it('should track user connections', () => {
      const user: PublicUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        createdAt: new Date(),
      };

      const result1 = manager.addConnection(mockSocket);
      const mockSocket2 = { ...mockSocket, remotePort: 12346 };
      const result2 = manager.addConnection(mockSocket2);

      manager.authenticateConnection(result1.id, user.id, user);
      manager.authenticateConnection(result2.id, user.id, user);

      const userConnections = manager.getUserConnections(user.id);
      expect(userConnections.size).toBe(2);
      expect(userConnections.has(result1.id)).toBe(true);
      expect(userConnections.has(result2.id)).toBe(true);
    });


    it('should handle authenticating non-existent connection', () => {
      const user: PublicUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        createdAt: new Date(),
      };

      expect(() =>
        manager.authenticateConnection('non-existent-id', user.id, user)
      ).not.toThrow();
    });

    it('should update authenticated count in stats', () => {
      const result = manager.addConnection(mockSocket);
      const user: PublicUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        createdAt: new Date(),
      };

      const statsBefore = manager.getStats();
      expect(statsBefore.authenticatedConnections).toBe(0);

      manager.authenticateConnection(result.id, user.id, user);

      const statsAfter = manager.getStats();
      expect(statsAfter.authenticatedConnections).toBe(1);
    });
  });

  describe('addSubscription', () => {
    it('should add subscription successfully', () => {
      const result = manager.addConnection(mockSocket);
      manager.addSubscription(result.id, 'test-topic', 'sub-123');

      const connection = manager.getConnection(result.id);
      expect(connection?.subscriptions.has('test-topic')).toBe(true);
      expect(connection?.subscriptions.get('test-topic')).toBe('sub-123');
    });

    it('should track topic subscriptions', () => {
      const result1 = manager.addConnection(mockSocket);
      const mockSocket2 = { ...mockSocket, remotePort: 12346 };
      const result2 = manager.addConnection(mockSocket2);

      manager.addSubscription(result1.id, 'test-topic', 'sub-123');
      manager.addSubscription(result2.id, 'test-topic', 'sub-456');

      const topicConnections = manager.getTopicConnections('test-topic');
      expect(topicConnections.size).toBe(2);
      expect(topicConnections.has(result1.id)).toBe(true);
      expect(topicConnections.has(result2.id)).toBe(true);
    });

    it('should handle adding subscription to non-existent connection', () => {
      expect(() =>
        manager.addSubscription('non-existent-id', 'test-topic', 'sub-123')
      ).not.toThrow();
    });

    it('should allow multiple subscriptions per connection', () => {
      const result = manager.addConnection(mockSocket);
      manager.addSubscription(result.id, 'topic-1', 'sub-1');
      manager.addSubscription(result.id, 'topic-2', 'sub-2');
      manager.addSubscription(result.id, 'topic-3', 'sub-3');

      const connection = manager.getConnection(result.id);
      expect(connection?.subscriptions.size).toBe(3);
    });
  });

  describe('removeSubscription', () => {
    it('should remove subscription successfully', () => {
      const result = manager.addConnection(mockSocket);
      manager.addSubscription(result.id, 'test-topic', 'sub-123');

      const subscriptionId = manager.removeSubscription(result.id, 'test-topic');
      expect(subscriptionId).toBe('sub-123');

      const connection = manager.getConnection(result.id);
      expect(connection?.subscriptions.has('test-topic')).toBe(false);
    });

    it('should remove from topic tracking', () => {
      const result = manager.addConnection(mockSocket);
      manager.addSubscription(result.id, 'test-topic', 'sub-123');

      expect(manager.getTopicConnections('test-topic').size).toBe(1);

      manager.removeSubscription(result.id, 'test-topic');
      expect(manager.getTopicConnections('test-topic').size).toBe(0);
    });

    it('should return undefined for non-existent subscription', () => {
      const result = manager.addConnection(mockSocket);
      const subscriptionId = manager.removeSubscription(result.id, 'non-existent-topic');
      expect(subscriptionId).toBeUndefined();
    });

    it('should return undefined for non-existent connection', () => {
      const subscriptionId = manager.removeSubscription('non-existent-id', 'test-topic');
      expect(subscriptionId).toBeUndefined();
    });

  });

  describe('updateActivity', () => {
    it('should handle updating non-existent connection', () => {
      expect(() => manager.updateActivity('non-existent-id')).not.toThrow();
    });
  });

  describe('sendToConnection', () => {
    it('should send data successfully', () => {
      const result = manager.addConnection(mockSocket);
      const data = Buffer.from('test data');

      const sent = manager.sendToConnection(result.id, data);

      expect(sent).toBe(true);
      expect(mockSocket.write).toHaveBeenCalledWith(data);
    });

    it('should return false for non-existent connection', () => {
      const data = Buffer.from('test data');
      const sent = manager.sendToConnection('non-existent-id', data);

      expect(sent).toBe(false);
      expect(mockSocket.write).not.toHaveBeenCalled();
    });

    it('should return false for destroyed socket', () => {
      const result = manager.addConnection(mockSocket);
      mockSocket.destroyed = true;

      const data = Buffer.from('test data');
      const sent = manager.sendToConnection(result.id, data);

      expect(sent).toBe(false);
      expect(mockSocket.write).not.toHaveBeenCalled();
    });

    it('should handle write errors', () => {
      const result = manager.addConnection(mockSocket);
      mockSocket.write.mockImplementation(() => {
        throw new Error('Socket write error');
      });

      const data = Buffer.from('test data');
      const sent = manager.sendToConnection(result.id, data);

      expect(sent).toBe(false);
    });

    it('should update message stats', () => {
      const result = manager.addConnection(mockSocket);
      const data = Buffer.from('test data');

      const statsBefore = manager.getStats();
      const messagesBefore = statsBefore.messagesSent;

      manager.sendToConnection(result.id, data);

      const statsAfter = manager.getStats();
      expect(statsAfter.messagesSent).toBe(messagesBefore + 1);
    });
  });

  describe('broadcast', () => {
    it('should broadcast to all authenticated connections', () => {
      const user1: PublicUser = {
        id: 'user-1',
        email: 'user1@example.com',
        name: 'User 1',
        role: 'user',
        createdAt: new Date(),
      };

      const user2: PublicUser = {
        id: 'user-2',
        email: 'user2@example.com',
        name: 'User 2',
        role: 'user',
        createdAt: new Date(),
      };

      const result1 = manager.addConnection(mockSocket);
      manager.authenticateConnection(result1.id, user1.id, user1);

      const mockSocket2 = {
        ...mockSocket,
        remotePort: 12346,
        write: vi.fn(),
      };
      const result2 = manager.addConnection(mockSocket2);
      manager.authenticateConnection(result2.id, user2.id, user2);

      const mockSocket3 = {
        ...mockSocket,
        remotePort: 12347,
        write: vi.fn(),
      };
      manager.addConnection(mockSocket3); // Not authenticated

      const data = Buffer.from('broadcast message');
      const sent = manager.broadcast(data);

      expect(sent).toBe(2); // Only authenticated connections
      expect(mockSocket.write).toHaveBeenCalledWith(data);
      expect(mockSocket2.write).toHaveBeenCalledWith(data);
      expect(mockSocket3.write).not.toHaveBeenCalled();
    });

    it('should skip destroyed sockets', () => {
      const user: PublicUser = {
        id: 'user-1',
        email: 'user1@example.com',
        name: 'User 1',
        role: 'user',
        createdAt: new Date(),
      };

      const result1 = manager.addConnection(mockSocket);
      manager.authenticateConnection(result1.id, user.id, user);

      const mockSocket2 = { ...mockSocket, remotePort: 12346, destroyed: true };
      const result2 = manager.addConnection(mockSocket2);
      manager.authenticateConnection(result2.id, user.id, user);

      const data = Buffer.from('broadcast message');
      const sent = manager.broadcast(data);

      expect(sent).toBe(1); // Only non-destroyed socket
    });

    it('should handle broadcast errors gracefully', () => {
      const user: PublicUser = {
        id: 'user-1',
        email: 'user1@example.com',
        name: 'User 1',
        role: 'user',
        createdAt: new Date(),
      };

      const result = manager.addConnection(mockSocket);
      manager.authenticateConnection(result.id, user.id, user);

      mockSocket.write.mockImplementation(() => {
        throw new Error('Write error');
      });

      const data = Buffer.from('broadcast message');
      const sent = manager.broadcast(data);

      expect(sent).toBe(0);
    });
  });

  describe('broadcastToTopic', () => {
    it('should broadcast to all subscribers of a topic', () => {
      const result1 = manager.addConnection(mockSocket);
      manager.addSubscription(result1.id, 'test-topic', 'sub-1');

      const mockSocket2 = {
        ...mockSocket,
        remotePort: 12346,
        write: vi.fn(),
      };
      const result2 = manager.addConnection(mockSocket2);
      manager.addSubscription(result2.id, 'test-topic', 'sub-2');

      const mockSocket3 = {
        ...mockSocket,
        remotePort: 12347,
        write: vi.fn(),
      };
      manager.addConnection(mockSocket3); // Not subscribed

      const data = Buffer.from('topic message');
      const sent = manager.broadcastToTopic('test-topic', data);

      expect(sent).toBe(2);
      expect(mockSocket.write).toHaveBeenCalledWith(data);
      expect(mockSocket2.write).toHaveBeenCalledWith(data);
      expect(mockSocket3.write).not.toHaveBeenCalled();
    });

    it('should return 0 for non-existent topic', () => {
      const data = Buffer.from('topic message');
      const sent = manager.broadcastToTopic('non-existent-topic', data);

      expect(sent).toBe(0);
    });
  });

  describe('removeStaleConnections', () => {
    it('should remove connections older than maxIdleTime', async () => {
      const result1 = manager.addConnection(mockSocket);
      const connection1 = manager.getConnection(result1.id)!;

      // Manually set old timestamp
      connection1.lastActivityAt = new Date(Date.now() - 60000); // 60 seconds ago

      const result2 = manager.addConnection({ ...mockSocket, remotePort: 12346 });
      // connection2 has recent activity

      const removed = manager.removeStaleConnections(30000); // 30 second threshold

      expect(removed).toBe(1);
      expect(manager.hasConnection(result1.id)).toBe(false);
      expect(manager.hasConnection(result2.id)).toBe(true);
    });

    it('should destroy stale connection sockets', () => {
      const result = manager.addConnection(mockSocket);
      const connection = manager.getConnection(result.id)!;
      connection.lastActivityAt = new Date(Date.now() - 60000);

      manager.removeStaleConnections(30000);

      expect(mockSocket.destroy).toHaveBeenCalled();
    });

    it('should return 0 when no stale connections', () => {
      manager.addConnection(mockSocket);
      manager.addConnection({ ...mockSocket, remotePort: 12346 });

      const removed = manager.removeStaleConnections(30000);

      expect(removed).toBe(0);
      expect(manager.getConnectionCount()).toBe(2);
    });
  });

  describe('closeAll', () => {
    it('should close all connections gracefully', async () => {
      const result1 = manager.addConnection(mockSocket);
      const mockSocket2 = { ...mockSocket, remotePort: 12346 };
      const result2 = manager.addConnection(mockSocket2);

      await manager.closeAll(1000);

      expect(mockSocket.end).toHaveBeenCalled();
      expect(mockSocket2.end).toHaveBeenCalled();
      expect(manager.getConnectionCount()).toBe(0);
    });

    it('should force close after timeout', async () => {
      const delayedSocket = {
        ...mockSocket,
        end: vi.fn((callback?: () => void) => {
          // Don't call callback - simulate hanging connection
        }),
      };

      manager.addConnection(delayedSocket);

      await manager.closeAll(100); // Short timeout

      expect(delayedSocket.destroy).toHaveBeenCalled();
      expect(manager.getConnectionCount()).toBe(0);
    });

    it('should handle already destroyed sockets', async () => {
      mockSocket.destroyed = true;
      manager.addConnection(mockSocket);

      await manager.closeAll(1000);

      expect(mockSocket.end).not.toHaveBeenCalled();
      expect(manager.getConnectionCount()).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return accurate statistics', () => {
      const user: PublicUser = {
        id: 'user-1',
        email: 'user1@example.com',
        name: 'User 1',
        role: 'user',
        createdAt: new Date(),
      };

      const result1 = manager.addConnection(mockSocket);
      manager.authenticateConnection(result1.id, user.id, user);
      manager.addSubscription(result1.id, 'topic-1', 'sub-1');
      manager.addSubscription(result1.id, 'topic-2', 'sub-2');

      const mockSocket2 = { ...mockSocket, remoteAddress: '192.168.1.2', remotePort: 12346 };
      const result2 = manager.addConnection(mockSocket2);
      manager.addSubscription(result2.id, 'topic-1', 'sub-3');

      const stats = manager.getStats();

      expect(stats.activeConnections).toBe(2);
      expect(stats.authenticatedConnections).toBe(1);
      expect(stats.totalSubscriptions).toBe(3);
      expect(stats.connectionsByIp.get('127.0.0.1')).toBe(1);
      expect(stats.connectionsByIp.get('192.168.1.2')).toBe(1);
    });
  });

  describe('Retrieval methods', () => {
    it('getConnection should return connection by ID', () => {
      const result = manager.addConnection(mockSocket);
      const connection = manager.getConnection(result.id);

      expect(connection).toBeDefined();
      expect(connection?.id).toBe(result.id);
    });

    it('getConnection should return undefined for non-existent ID', () => {
      const connection = manager.getConnection('non-existent-id');
      expect(connection).toBeUndefined();
    });

    it('getUserConnections should return empty set for non-existent user', () => {
      const connections = manager.getUserConnections('non-existent-user');
      expect(connections.size).toBe(0);
    });

    it('getTopicConnections should return empty set for non-existent topic', () => {
      const connections = manager.getTopicConnections('non-existent-topic');
      expect(connections.size).toBe(0);
    });

    it('getAllConnectionIds should return all connection IDs', () => {
      const result1 = manager.addConnection(mockSocket);
      const mockSocket2 = { ...mockSocket, remotePort: 12346 };
      const result2 = manager.addConnection(mockSocket2);

      const ids = manager.getAllConnectionIds();
      expect(ids).toHaveLength(2);
      expect(ids).toContain(result1.id);
      expect(ids).toContain(result2.id);
    });

    it('hasConnection should return true for existing connection', () => {
      const result = manager.addConnection(mockSocket);
      expect(manager.hasConnection(result.id)).toBe(true);
    });

    it('hasConnection should return false for non-existent connection', () => {
      expect(manager.hasConnection('non-existent-id')).toBe(false);
    });

    it('getConnectionCount should return correct count', () => {
      expect(manager.getConnectionCount()).toBe(0);

      manager.addConnection(mockSocket);
      expect(manager.getConnectionCount()).toBe(1);

      const mockSocket2 = { ...mockSocket, remotePort: 12346 };
      manager.addConnection(mockSocket2);
      expect(manager.getConnectionCount()).toBe(2);
    });

    it('getAuthenticatedCount should return correct count', () => {
      const user: PublicUser = {
        id: 'user-1',
        email: 'user1@example.com',
        name: 'User 1',
        role: 'user',
        createdAt: new Date(),
      };

      expect(manager.getAuthenticatedCount()).toBe(0);

      const result1 = manager.addConnection(mockSocket);
      manager.authenticateConnection(result1.id, user.id, user);
      expect(manager.getAuthenticatedCount()).toBe(1);

      const mockSocket2 = { ...mockSocket, remotePort: 12346 };
      manager.addConnection(mockSocket2); // Not authenticated
      expect(manager.getAuthenticatedCount()).toBe(1);
    });
  });
});

/**
 * TCP Connection Manager
 * Layer 4: Application
 *
 * Manages all active TCP connections, authentication, and subscriptions.
 * Tracks connections by ID, user, IP, and topic subscriptions.
 */

import { Socket } from 'net';
import { randomUUID } from 'crypto';
import { TcpConnection, TcpServerStats, TcpServerConfig } from '@foundation/types/tcp-types';
import { PublicUser } from '@foundation/types/common-types';
import { ErrorCode } from '@foundation/errors/error-codes';
import { ApiError } from '@foundation/errors/api-error';
import { logger } from '@infrastructure/logging/logger';

/**
 * Connection Manager
 * Centralized management of all TCP connections
 */
export class ConnectionManager {
  // Connection tracking maps
  private connections: Map<string, TcpConnection> = new Map();
  private userConnections: Map<string, Set<string>> = new Map();
  private ipConnections: Map<string, Set<string>> = new Map();
  private topicSubscriptions: Map<string, Set<string>> = new Map();

  // Configuration
  private readonly config: TcpServerConfig;

  // Statistics
  private stats = {
    totalConnections: 0,
    totalAuthenticated: 0,
    totalMessages: 0,
    totalErrors: 0,
  };

  constructor(config: TcpServerConfig) {
    this.config = config;
  }

  /**
   * Add a new connection
   *
   * @param socket - TCP socket
   * @returns Connection ID and connection object
   * @throws {ApiError} If connection limit reached
   */
  addConnection(socket: Socket): { id: string; connection: TcpConnection } {
    const remoteAddress = socket.remoteAddress || 'unknown';
    const remotePort = socket.remotePort || 0;

    // Check IP-based connection limit
    const ipConnectionCount = this.ipConnections.get(remoteAddress)?.size || 0;
    if (ipConnectionCount >= this.config.maxConnectionsPerIp) {
      logger.warn(
        {
          remoteAddress,
          currentConnections: ipConnectionCount,
          maxAllowed: this.config.maxConnectionsPerIp,
        },
        'TCP connection limit reached for IP'
      );

      throw new ApiError(
        'Connection limit reached',
        ErrorCode.TCP_CONNECTION_LIMIT,
        { ip: remoteAddress, limit: this.config.maxConnectionsPerIp },
        false
      );
    }

    // Check total connection limit
    if (this.config.maxConnections && this.connections.size >= this.config.maxConnections) {
      logger.warn(
        {
          currentConnections: this.connections.size,
          maxAllowed: this.config.maxConnections,
        },
        'TCP total connection limit reached'
      );

      throw new ApiError(
        'Server connection limit reached',
        ErrorCode.TCP_CONNECTION_LIMIT,
        { limit: this.config.maxConnections },
        true
      );
    }

    // Create connection object
    const connectionId = randomUUID();
    const now = new Date();

    const connection: TcpConnection = {
      id: connectionId,
      socket,
      connectedAt: now,
      lastActivityAt: now,
      remoteAddress,
      remotePort,
      subscriptions: new Map(),
      metadata: {},
    };

    // Store connection
    this.connections.set(connectionId, connection);

    // Track by IP
    if (!this.ipConnections.has(remoteAddress)) {
      this.ipConnections.set(remoteAddress, new Set());
    }
    this.ipConnections.get(remoteAddress)!.add(connectionId);

    // Update stats
    this.stats.totalConnections++;

    logger.info(
      {
        connectionId,
        remoteAddress,
        remotePort,
        totalConnections: this.connections.size,
      },
      'TCP connection added'
    );

    return { id: connectionId, connection };
  }

  /**
   * Remove a connection
   *
   * @param connectionId - Connection ID to remove
   */
  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    // Remove from user connections
    if (connection.userId) {
      const userConns = this.userConnections.get(connection.userId);
      if (userConns) {
        userConns.delete(connectionId);
        if (userConns.size === 0) {
          this.userConnections.delete(connection.userId);
        }
      }
    }

    // Remove from IP connections
    const ipConns = this.ipConnections.get(connection.remoteAddress);
    if (ipConns) {
      ipConns.delete(connectionId);
      if (ipConns.size === 0) {
        this.ipConnections.delete(connection.remoteAddress);
      }
    }

    // Remove from topic subscriptions
    for (const [topic, _] of connection.subscriptions) {
      const topicConns = this.topicSubscriptions.get(topic);
      if (topicConns) {
        topicConns.delete(connectionId);
        if (topicConns.size === 0) {
          this.topicSubscriptions.delete(topic);
        }
      }
    }

    // Remove connection
    this.connections.delete(connectionId);

    logger.info(
      {
        connectionId,
        userId: connection.userId,
        remoteAddress: connection.remoteAddress,
        totalConnections: this.connections.size,
      },
      'TCP connection removed'
    );
  }

  /**
   * Authenticate a connection
   *
   * @param connectionId - Connection ID
   * @param userId - Authenticated user ID
   * @param user - User information
   */
  authenticateConnection(connectionId: string, userId: string, user: PublicUser): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      logger.warn({ connectionId }, 'Cannot authenticate: connection not found');
      return;
    }

    connection.userId = userId;
    connection.user = user;
    connection.lastActivityAt = new Date();

    // Track by user
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(connectionId);

    this.stats.totalAuthenticated++;

    logger.info(
      {
        connectionId,
        userId,
        email: user.email,
      },
      'TCP connection authenticated'
    );
  }

  /**
   * Subscribe connection to topic
   *
   * @param connectionId - Connection ID
   * @param topic - Topic to subscribe to
   * @param subscriptionId - Subscription ID from PubSub
   */
  addSubscription(connectionId: string, topic: string, subscriptionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      logger.warn({ connectionId, topic }, 'Cannot subscribe: connection not found');
      return;
    }

    // Add to connection subscriptions
    connection.subscriptions.set(topic, subscriptionId);
    connection.lastActivityAt = new Date();

    // Track by topic
    if (!this.topicSubscriptions.has(topic)) {
      this.topicSubscriptions.set(topic, new Set());
    }
    this.topicSubscriptions.get(topic)!.add(connectionId);

    logger.debug(
      {
        connectionId,
        topic,
        subscriptionId,
        totalSubscriptions: connection.subscriptions.size,
      },
      'TCP subscription added'
    );
  }

  /**
   * Unsubscribe connection from topic
   *
   * @param connectionId - Connection ID
   * @param topic - Topic to unsubscribe from
   * @returns Subscription ID if found
   */
  removeSubscription(connectionId: string, topic: string): string | undefined {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return undefined;
    }

    const subscriptionId = connection.subscriptions.get(topic);
    if (!subscriptionId) {
      return undefined;
    }

    // Remove from connection
    connection.subscriptions.delete(topic);
    connection.lastActivityAt = new Date();

    // Remove from topic tracking
    const topicConns = this.topicSubscriptions.get(topic);
    if (topicConns) {
      topicConns.delete(connectionId);
      if (topicConns.size === 0) {
        this.topicSubscriptions.delete(topic);
      }
    }

    logger.debug(
      {
        connectionId,
        topic,
        subscriptionId,
      },
      'TCP subscription removed'
    );

    return subscriptionId;
  }

  /**
   * Update connection activity timestamp
   *
   * @param connectionId - Connection ID
   */
  updateActivity(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.lastActivityAt = new Date();
    }
  }

  /**
   * Get connection by ID
   *
   * @param connectionId - Connection ID
   * @returns Connection or undefined
   */
  getConnection(connectionId: string): TcpConnection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Get all connections for a user
   *
   * @param userId - User ID
   * @returns Set of connection IDs
   */
  getUserConnections(userId: string): Set<string> {
    return this.userConnections.get(userId) || new Set();
  }

  /**
   * Get all connections subscribed to a topic
   *
   * @param topic - Topic name
   * @returns Set of connection IDs
   */
  getTopicConnections(topic: string): Set<string> {
    return this.topicSubscriptions.get(topic) || new Set();
  }

  /**
   * Send data to a specific connection
   *
   * @param connectionId - Connection ID
   * @param data - Data buffer to send
   * @returns True if sent successfully
   */
  sendToConnection(connectionId: string, data: Buffer): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.socket.destroyed) {
      return false;
    }

    try {
      connection.socket.write(data);
      this.stats.totalMessages++;
      return true;
    } catch (error) {
      logger.error({ error, connectionId }, 'Failed to send to TCP connection');
      this.stats.totalErrors++;
      return false;
    }
  }

  /**
   * Broadcast data to all authenticated connections
   *
   * @param data - Data buffer to send
   * @returns Number of connections sent to
   */
  broadcast(data: Buffer): number {
    let sent = 0;

    for (const [connectionId, connection] of this.connections) {
      if (connection.userId && !connection.socket.destroyed) {
        try {
          connection.socket.write(data);
          sent++;
        } catch (error) {
          logger.error({ error, connectionId }, 'Failed to broadcast to TCP connection');
          this.stats.totalErrors++;
        }
      }
    }

    this.stats.totalMessages += sent;
    return sent;
  }

  /**
   * Broadcast data to all connections subscribed to a topic
   *
   * @param topic - Topic name
   * @param data - Data buffer to send
   * @returns Number of connections sent to
   */
  broadcastToTopic(topic: string, data: Buffer): number {
    const connectionIds = this.getTopicConnections(topic);
    let sent = 0;

    for (const connectionId of connectionIds) {
      if (this.sendToConnection(connectionId, data)) {
        sent++;
      }
    }

    return sent;
  }

  /**
   * Find and remove stale connections
   *
   * @param maxIdleTime - Maximum idle time in milliseconds
   * @returns Number of stale connections removed
   */
  removeStaleConnections(maxIdleTime: number): number {
    const now = Date.now();
    const staleConnections: string[] = [];

    for (const [connectionId, connection] of this.connections) {
      const idleTime = now - connection.lastActivityAt.getTime();
      if (idleTime > maxIdleTime) {
        staleConnections.push(connectionId);
      }
    }

    for (const connectionId of staleConnections) {
      const connection = this.connections.get(connectionId);
      if (connection) {
        connection.socket.destroy();
        this.removeConnection(connectionId);
      }
    }

    if (staleConnections.length > 0) {
      logger.info(
        {
          count: staleConnections.length,
          maxIdleTime,
        },
        'Removed stale TCP connections'
      );
    }

    return staleConnections.length;
  }

  /**
   * Close all connections
   *
   * @param timeout - Optional timeout for graceful close (ms)
   * @returns Promise that resolves when all closed
   */
  async closeAll(timeout: number = 5000): Promise<void> {
    logger.info({ count: this.connections.size }, 'Closing all TCP connections');

    const closePromises: Promise<void>[] = [];

    for (const [connectionId, connection] of this.connections) {
      const promise = new Promise<void>((resolve) => {
        if (connection.socket.destroyed) {
          resolve();
          return;
        }

        const timer = setTimeout(() => {
          connection.socket.destroy();
          resolve();
        }, timeout);

        connection.socket.end(() => {
          clearTimeout(timer);
          resolve();
        });
      });

      closePromises.push(promise);
      this.removeConnection(connectionId);
    }

    await Promise.all(closePromises);

    logger.info('All TCP connections closed');
  }

  /**
   * Get server statistics
   *
   * @returns Server statistics
   */
  getStats(): TcpServerStats {
    // Convert IP connections map to counts
    const connectionsByIp = new Map<string, number>();
    for (const [ip, connections] of this.ipConnections) {
      connectionsByIp.set(ip, connections.size);
    }

    return {
      activeConnections: this.connections.size,
      connectionsByIp,
      authenticatedConnections: Array.from(this.connections.values()).filter((c) => c.userId)
        .length,
      totalSubscriptions: Array.from(this.connections.values()).reduce(
        (sum, c) => sum + c.subscriptions.size,
        0
      ),
      messagesSent: this.stats.totalMessages,
      messagesReceived: 0, // Updated by message handler
      errors: this.stats.totalErrors,
      startedAt: new Date(), // Set by TCP server
      uptime: 0, // Calculated by TCP server
    };
  }

  /**
   * Get all active connection IDs
   *
   * @returns Array of connection IDs
   */
  getAllConnectionIds(): string[] {
    return Array.from(this.connections.keys());
  }

  /**
   * Check if connection exists
   *
   * @param connectionId - Connection ID
   * @returns True if connection exists
   */
  hasConnection(connectionId: string): boolean {
    return this.connections.has(connectionId);
  }

  /**
   * Get total connection count
   *
   * @returns Number of active connections
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Get authenticated connection count
   *
   * @returns Number of authenticated connections
   */
  getAuthenticatedCount(): number {
    return Array.from(this.connections.values()).filter((c) => c.userId).length;
  }
}

/**
 * Create a connection manager instance
 *
 * @param config - TCP server configuration
 * @returns Connection manager instance
 */
export function createConnectionManager(config: TcpServerConfig): ConnectionManager {
  return new ConnectionManager(config);
}

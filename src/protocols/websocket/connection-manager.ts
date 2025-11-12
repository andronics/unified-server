/**
 * WebSocket Connection Manager
 * Layer 4: Application
 *
 * Manages all active WebSocket connections, tracks subscriptions,
 * and provides connection lifecycle management.
 */

import { v4 as uuidv4 } from 'uuid';
import { WebSocket } from 'ws';
import {
  WebSocketConnection,
  WebSocketErrorHandler,
} from '@shared/types/websocket-types';
import { logger } from '@infrastructure/logging/logger';

export class ConnectionManager {
  private connections: Map<string, WebSocketConnection>;
  private userConnections: Map<string, Set<string>>; // userId -> connection IDs
  private topicSubscriptions: Map<string, Set<string>>; // topic -> connection IDs
  private ipConnections: Map<string, Set<string>>; // IP address -> connection IDs

  constructor() {
    this.connections = new Map();
    this.userConnections = new Map();
    this.topicSubscriptions = new Map();
    this.ipConnections = new Map();
  }

  /**
   * Add a new WebSocket connection
   */
  addConnection(
    socket: WebSocket,
    metadata: {
      ip?: string;
      userAgent?: string;
      [key: string]: any;
    } = {}
  ): WebSocketConnection {
    const connectionId = uuidv4();

    const connection: WebSocketConnection = {
      id: connectionId,
      socket,
      topics: new Set<string>(),
      connectedAt: new Date(),
      metadata,
    };

    this.connections.set(connectionId, connection);

    // Track by IP if provided
    if (metadata.ip) {
      if (!this.ipConnections.has(metadata.ip)) {
        this.ipConnections.set(metadata.ip, new Set());
      }
      this.ipConnections.get(metadata.ip)!.add(connectionId);
    }

    logger.info(
      {
        connectionId,
        ip: metadata.ip,
        totalConnections: this.connections.size,
      },
      'WebSocket connection added'
    );

    return connection;
  }

  /**
   * Remove a connection and clean up all associated data
   */
  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      logger.warn({ connectionId }, 'Attempted to remove non-existent connection');
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

    // Remove from topic subscriptions
    for (const topic of connection.topics) {
      const topicConns = this.topicSubscriptions.get(topic);
      if (topicConns) {
        topicConns.delete(connectionId);
        if (topicConns.size === 0) {
          this.topicSubscriptions.delete(topic);
        }
      }
    }

    // Remove from IP connections
    if (connection.metadata.ip) {
      const ipConns = this.ipConnections.get(connection.metadata.ip);
      if (ipConns) {
        ipConns.delete(connectionId);
        if (ipConns.size === 0) {
          this.ipConnections.delete(connection.metadata.ip);
        }
      }
    }

    // Remove the connection
    this.connections.delete(connectionId);

    logger.info(
      {
        connectionId,
        userId: connection.userId,
        subscriptionCount: connection.topics.size,
        remainingConnections: this.connections.size,
      },
      'WebSocket connection removed'
    );
  }

  /**
   * Get a connection by ID
   */
  getConnection(connectionId: string): WebSocketConnection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Authenticate a connection with a user ID
   */
  authenticateConnection(connectionId: string, userId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    connection.userId = userId;

    // Track by user ID
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(connectionId);

    logger.info(
      {
        connectionId,
        userId,
        userConnectionCount: this.userConnections.get(userId)!.size,
      },
      'Connection authenticated'
    );
  }

  /**
   * Get all connections for a user
   */
  getUserConnections(userId: string): WebSocketConnection[] {
    const connectionIds = this.userConnections.get(userId);
    if (!connectionIds) {
      return [];
    }

    return Array.from(connectionIds)
      .map((id) => this.connections.get(id))
      .filter((conn): conn is WebSocketConnection => conn !== undefined);
  }

  /**
   * Subscribe a connection to a topic
   */
  subscribe(connectionId: string, topic: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    // Add to connection's topics
    connection.topics.add(topic);

    // Track in topic subscriptions
    if (!this.topicSubscriptions.has(topic)) {
      this.topicSubscriptions.set(topic, new Set());
    }
    this.topicSubscriptions.get(topic)!.add(connectionId);

    logger.debug(
      {
        connectionId,
        topic,
        connectionTopicCount: connection.topics.size,
        topicSubscriberCount: this.topicSubscriptions.get(topic)!.size,
      },
      'Connection subscribed to topic'
    );
  }

  /**
   * Unsubscribe a connection from a topic
   */
  unsubscribe(connectionId: string, topic: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      logger.warn({ connectionId, topic }, 'Attempted to unsubscribe non-existent connection');
      return;
    }

    // Remove from connection's topics
    connection.topics.delete(topic);

    // Remove from topic subscriptions
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
        connectionTopicCount: connection.topics.size,
      },
      'Connection unsubscribed from topic'
    );
  }

  /**
   * Get all connections subscribed to a topic
   */
  getTopicConnections(topic: string): WebSocketConnection[] {
    const connectionIds = this.topicSubscriptions.get(topic);
    if (!connectionIds) {
      return [];
    }

    return Array.from(connectionIds)
      .map((id) => this.connections.get(id))
      .filter((conn): conn is WebSocketConnection => conn !== undefined);
  }

  /**
   * Get all active connections
   */
  getAllConnections(): WebSocketConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get connection count for an IP address
   */
  getIpConnectionCount(ip: string): number {
    return this.ipConnections.get(ip)?.size || 0;
  }

  /**
   * Update connection ping/pong timestamps
   */
  updatePing(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.lastPing = new Date();
    }
  }

  updatePong(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.lastPong = new Date();
    }
  }

  /**
   * Get connections that haven't ponged within timeout
   */
  getStaleConnections(timeoutMs: number): WebSocketConnection[] {
    const now = Date.now();
    const staleConnections: WebSocketConnection[] = [];

    for (const connection of this.connections.values()) {
      if (connection.lastPing) {
        const timeSinceLastPing = now - connection.lastPing.getTime();
        const hasPonged = connection.lastPong && connection.lastPong >= connection.lastPing;

        if (timeSinceLastPing > timeoutMs && !hasPonged) {
          staleConnections.push(connection);
        }
      }
    }

    return staleConnections;
  }

  /**
   * Broadcast a message to multiple connections
   */
  broadcast(
    connections: WebSocketConnection[],
    message: any,
    onError?: WebSocketErrorHandler
  ): void {
    const messageStr = JSON.stringify(message);

    for (const connection of connections) {
      try {
        if (connection.socket.readyState === WebSocket.OPEN) {
          connection.socket.send(messageStr);
        }
      } catch (error) {
        logger.error(
          {
            error,
            connectionId: connection.id,
            userId: connection.userId,
          },
          'Failed to send message to connection'
        );

        if (onError) {
          onError(connection, error as Error);
        }
      }
    }
  }

  /**
   * Send a message to a specific connection
   */
  sendToConnection(connectionId: string, message: any): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      logger.warn({ connectionId }, 'Attempted to send to non-existent connection');
      return false;
    }

    if (connection.socket.readyState !== WebSocket.OPEN) {
      logger.warn({ connectionId }, 'Connection not in OPEN state');
      return false;
    }

    try {
      connection.socket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      logger.error(
        {
          error,
          connectionId,
          userId: connection.userId,
        },
        'Failed to send message to connection'
      );
      return false;
    }
  }

  /**
   * Get connection statistics
   */
  getStats() {
    return {
      totalConnections: this.connections.size,
      authenticatedConnections: this.userConnections.size,
      uniqueUsers: this.userConnections.size,
      activeTopics: this.topicSubscriptions.size,
      uniqueIps: this.ipConnections.size,
      topicStats: Array.from(this.topicSubscriptions.entries()).map(([topic, connIds]) => ({
        topic,
        subscriberCount: connIds.size,
      })),
      ipStats: Array.from(this.ipConnections.entries())
        .map(([ip, connIds]) => ({
          ip,
          connectionCount: connIds.size,
        }))
        .sort((a, b) => b.connectionCount - a.connectionCount)
        .slice(0, 10), // Top 10 IPs
    };
  }

  /**
   * Close all connections and cleanup
   */
  async closeAll(): Promise<void> {
    logger.info({ connectionCount: this.connections.size }, 'Closing all WebSocket connections');

    const closePromises: Promise<void>[] = [];

    for (const connection of this.connections.values()) {
      const promise = new Promise<void>((resolve) => {
        if (connection.socket.readyState === WebSocket.OPEN) {
          connection.socket.close(1000, 'Server shutting down');
          connection.socket.once('close', () => resolve());
          // Timeout after 5 seconds
          setTimeout(() => resolve(), 5000);
        } else {
          resolve();
        }
      });
      closePromises.push(promise);
    }

    await Promise.all(closePromises);

    // Clear all maps
    this.connections.clear();
    this.userConnections.clear();
    this.topicSubscriptions.clear();
    this.ipConnections.clear();

    logger.info('All WebSocket connections closed');
  }
}

// Export singleton instance
export const connectionManager = new ConnectionManager();

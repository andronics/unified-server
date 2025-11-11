/**
 * WebSocket Server
 * Layer 4: Application
 *
 * Main WebSocket server implementation with connection management,
 * authentication, topic subscriptions, and real-time messaging.
 */

import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import {
  WebSocketServerConfig,
  WebSocketClientMessage,
  WebSocketServerMessage,
  ErrorMessage,
} from '@foundation/types/websocket-types';
import { ConnectionManager } from './connection-manager';
import { MessageHandler } from './message-handler';
import { logger } from '@infrastructure/logging/logger';
import { config } from '@infrastructure/config/config-loader';

export class WebSocketServer {
  private wss: WSServer | null = null;
  private connectionManager: ConnectionManager;
  private messageHandler: MessageHandler;
  private pingInterval: NodeJS.Timeout | null = null;
  private config: WebSocketServerConfig;

  constructor(
    connectionManager: ConnectionManager,
    messageHandler: MessageHandler,
    wsConfig?: Partial<WebSocketServerConfig>
  ) {
    this.connectionManager = connectionManager;
    this.messageHandler = messageHandler;

    // Merge config with defaults
    this.config = {
      port: wsConfig?.port || config.websocket.port,
      host: wsConfig?.host || config.websocket.host,
      enabled: wsConfig?.enabled ?? config.websocket.enabled,
      pingInterval: wsConfig?.pingInterval || config.websocket.pingInterval,
      pingTimeout: wsConfig?.pingTimeout || config.websocket.pingTimeout,
      maxConnectionsPerIp: wsConfig?.maxConnectionsPerIp,
      maxMessageSize: wsConfig?.maxMessageSize,
    };
  }

  /**
   * Start the WebSocket server
   */
  async start(httpServer: HttpServer): Promise<void> {
    if (!this.config.enabled) {
      logger.info('WebSocket server disabled in configuration');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        // Create WebSocket server attached to HTTP server
        this.wss = new WSServer({
          server: httpServer,
          path: '/ws',
          maxPayload: this.config.maxMessageSize || 1024 * 1024, // 1MB default
        });

        this.setupEventHandlers();
        this.startPingInterval();

        logger.info(
          {
            path: '/ws',
            pingInterval: this.config.pingInterval,
            pingTimeout: this.config.pingTimeout,
          },
          '✓ WebSocket server started'
        );

        resolve();
      } catch (error) {
        logger.error({ error }, 'Failed to start WebSocket server');
        reject(error);
      }
    });
  }

  /**
   * Setup WebSocket server event handlers
   */
  private setupEventHandlers(): void {
    if (!this.wss) {
      throw new Error('WebSocket server not initialized');
    }

    this.wss.on('connection', this.handleConnection.bind(this));

    this.wss.on('error', (error) => {
      logger.error({ error }, 'WebSocket server error');
    });

    logger.debug('WebSocket event handlers configured');
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(socket: WebSocket, request: any): void {
    // Extract client info
    const ip = request.socket.remoteAddress;
    const userAgent = request.headers['user-agent'];

    // Check IP connection limit
    if (this.config.maxConnectionsPerIp) {
      const currentConnections = this.connectionManager.getIpConnectionCount(ip);
      if (currentConnections >= this.config.maxConnectionsPerIp) {
        logger.warn({ ip, currentConnections }, 'Max connections per IP reached');
        socket.close(1008, 'Too many connections from this IP');
        return;
      }
    }

    // Add connection to manager
    const connection = this.connectionManager.addConnection(socket, {
      ip,
      userAgent,
    });

    logger.info(
      {
        connectionId: connection.id,
        ip,
        userAgent,
      },
      'New WebSocket connection'
    );

    // Setup socket event handlers
    socket.on('message', async (data: Buffer) => {
      try {
        await this.handleMessage(connection.id, data);
      } catch (error) {
        logger.error(
          {
            error,
            connectionId: connection.id,
          },
          'Error handling WebSocket message'
        );

        this.sendError(connection.id, 1, 'Internal server error');
      }
    });

    socket.on('pong', () => {
      this.connectionManager.updatePong(connection.id);
      logger.debug({ connectionId: connection.id }, 'Received pong');
    });

    socket.on('close', (code: number, reason: Buffer) => {
      logger.info(
        {
          connectionId: connection.id,
          userId: connection.userId,
          code,
          reason: reason.toString(),
        },
        'WebSocket connection closed'
      );

      this.connectionManager.removeConnection(connection.id);
    });

    socket.on('error', (error: Error) => {
      logger.error(
        {
          error,
          connectionId: connection.id,
          userId: connection.userId,
        },
        'WebSocket connection error'
      );

      this.connectionManager.removeConnection(connection.id);
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  private async handleMessage(connectionId: string, data: Buffer): Promise<void> {
    const connection = this.connectionManager.getConnection(connectionId);
    if (!connection) {
      logger.warn({ connectionId }, 'Message from unknown connection');
      return;
    }

    try {
      // Parse message
      const messageStr = data.toString('utf8');
      const message: WebSocketClientMessage = JSON.parse(messageStr);

      logger.debug(
        {
          connectionId,
          userId: connection.userId,
          messageType: message.type,
        },
        'Received WebSocket message'
      );

      // Delegate to message handler
      await this.messageHandler.handle(connection, message);
    } catch (error) {
      logger.error(
        {
          error,
          connectionId,
          userId: connection.userId,
        },
        'Failed to parse or handle message'
      );

      this.sendError(connectionId, 2, 'Invalid message format');
    }
  }

  /**
   * Send an error message to a connection
   */
  private sendError(connectionId: string, code: number, message: string, details?: any): void {
    const errorMessage: ErrorMessage = {
      type: 'error',
      code,
      message,
      details,
      timestamp: new Date().toISOString(),
    };

    this.connectionManager.sendToConnection(connectionId, errorMessage);
  }

  /**
   * Start ping interval to keep connections alive
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.pingInterval);

    logger.debug({ interval: this.config.pingInterval }, 'Ping interval started');
  }

  /**
   * Perform health check on all connections
   */
  private performHealthCheck(): void {
    const connections = this.connectionManager.getAllConnections();

    // Send ping to all connections
    for (const connection of connections) {
      if (connection.socket.readyState === WebSocket.OPEN) {
        connection.socket.ping();
        this.connectionManager.updatePing(connection.id);
      }
    }

    // Check for stale connections
    const staleConnections = this.connectionManager.getStaleConnections(this.config.pingTimeout);

    for (const connection of staleConnections) {
      logger.warn(
        {
          connectionId: connection.id,
          userId: connection.userId,
          lastPing: connection.lastPing,
          lastPong: connection.lastPong,
        },
        'Closing stale connection'
      );

      connection.socket.close(1000, 'Ping timeout');
      this.connectionManager.removeConnection(connection.id);
    }

    if (staleConnections.length > 0) {
      logger.info({ count: staleConnections.length }, 'Closed stale connections');
    }
  }

  /**
   * Stop the WebSocket server
   */
  async stop(): Promise<void> {
    logger.info('Stopping WebSocket server');

    // Stop ping interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    // Close all connections
    await this.connectionManager.closeAll();

    // Close WebSocket server
    if (this.wss) {
      return new Promise((resolve, reject) => {
        this.wss!.close((error) => {
          if (error) {
            logger.error({ error }, 'Error stopping WebSocket server');
            reject(error);
          } else {
            logger.info('WebSocket server stopped');
            this.wss = null;
            resolve();
          }
        });
      });
    }
  }

  /**
   * Get server statistics
   */
  getStats() {
    return {
      ...this.connectionManager.getStats(),
      config: {
        enabled: this.config.enabled,
        pingInterval: this.config.pingInterval,
        pingTimeout: this.config.pingTimeout,
        maxConnectionsPerIp: this.config.maxConnectionsPerIp,
        maxMessageSize: this.config.maxMessageSize,
      },
      serverState: {
        running: this.wss !== null,
        pingIntervalActive: this.pingInterval !== null,
      },
    };
  }

  /**
   * Broadcast message to topic subscribers
   */
  broadcastToTopic(topic: string, message: WebSocketServerMessage): void {
    const connections = this.connectionManager.getTopicConnections(topic);

    logger.debug(
      {
        topic,
        recipientCount: connections.length,
        messageType: message.type,
      },
      'Broadcasting to topic'
    );

    this.connectionManager.broadcast(connections, message);
  }

  /**
   * Send message to specific user (all their connections)
   */
  sendToUser(userId: string, message: WebSocketServerMessage): void {
    const connections = this.connectionManager.getUserConnections(userId);

    logger.debug(
      {
        userId,
        connectionCount: connections.length,
        messageType: message.type,
      },
      'Sending to user'
    );

    this.connectionManager.broadcast(connections, message);
  }
}

// Export singleton instance (will be initialized in main app)
export let websocketServer: WebSocketServer | null = null;

export function initializeWebSocketServer(
  connectionManager: ConnectionManager,
  messageHandler: MessageHandler,
  config?: Partial<WebSocketServerConfig>
): WebSocketServer {
  websocketServer = new WebSocketServer(connectionManager, messageHandler, config);
  return websocketServer;
}

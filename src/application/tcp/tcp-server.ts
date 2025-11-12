/**
 * TCP Server
 * Layer 4: Application
 *
 * Main TCP server implementation using Node.js net module.
 * Manages server lifecycle, connections, and integrates all TCP components.
 */

import * as net from 'net';
import { EventEmitter } from 'events';
import { ValidatedConfig } from '@infrastructure/config/config-schema';
import { ConnectionManager } from './connection-manager';
import { FrameParser } from './frame-parser';
import { ProtocolCodec } from './protocol-codec';
import { TcpMessageType, TcpServerStats } from '@foundation/types/tcp-types';
import { ErrorCode } from '@foundation/errors/error-codes';
import { ApiError } from '@foundation/errors/api-error';
import { logger } from '@infrastructure/logging/logger';

/**
 * TCP Server Events
 */
export interface TcpServerEvents {
  connection: (connectionId: string, remoteAddress: string) => void;
  disconnect: (connectionId: string) => void;
  authenticated: (connectionId: string, userId: string) => void;
  message: (connectionId: string, type: TcpMessageType, data: unknown) => void;
  error: (error: Error, connectionId?: string) => void;
  started: () => void;
  stopped: () => void;
}

/**
 * TCP Server
 * Manages TCP server lifecycle and connection handling
 */
export class TcpServer extends EventEmitter {
  private server: net.Server | null = null;
  private connectionManager: ConnectionManager;
  private codec: ProtocolCodec;
  private readonly config: NonNullable<ValidatedConfig['tcp']>;
  private pingIntervalHandle: NodeJS.Timeout | null = null;
  private staleCheckIntervalHandle: NodeJS.Timeout | null = null;
  private startedAt: Date | null = null;
  private isShuttingDown = false;

  constructor(config: ValidatedConfig) {
    super();

    if (!config.tcp) {
      throw new Error('TCP configuration is required');
    }

    this.config = config.tcp;
    this.connectionManager = new ConnectionManager(this.config);
    this.codec = new ProtocolCodec({
      maxFrameSize: this.config.maxFrameSize,
    });

    logger.info({ config: this.config }, 'TCP server initialized');
  }

  /**
   * Start the TCP server
   *
   * @returns Promise that resolves when server is listening
   */
  async start(): Promise<void> {
    if (this.server) {
      logger.warn('TCP server already started');
      return;
    }

    if (!this.config.enabled) {
      logger.info('TCP server is disabled in configuration');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.server = net.createServer((socket) => {
          this.handleConnection(socket);
        });

        // Server error handling
        this.server.on('error', (error) => {
          logger.error({ error }, 'TCP server error');
          this.emit('error', error);
          reject(error);
        });

        // Start listening
        this.server.listen(this.config.port, this.config.host, () => {
          this.startedAt = new Date();
          logger.info(
            {
              host: this.config.host,
              port: this.config.port,
            },
            'TCP server started'
          );

          // Start periodic tasks
          this.startPingInterval();
          this.startStaleConnectionCheck();

          this.emit('started');
          resolve();
        });
      } catch (error) {
        logger.error({ error }, 'Failed to start TCP server');
        reject(error);
      }
    });
  }

  /**
   * Stop the TCP server
   *
   * @param timeout - Graceful shutdown timeout in milliseconds
   * @returns Promise that resolves when server is stopped
   */
  async stop(timeout: number = 5000): Promise<void> {
    if (!this.server) {
      logger.warn('TCP server not running');
      return;
    }

    this.isShuttingDown = true;

    logger.info({ timeout }, 'Stopping TCP server');

    // Stop periodic tasks
    if (this.pingIntervalHandle) {
      clearInterval(this.pingIntervalHandle);
      this.pingIntervalHandle = null;
    }

    if (this.staleCheckIntervalHandle) {
      clearInterval(this.staleCheckIntervalHandle);
      this.staleCheckIntervalHandle = null;
    }

    // Close all connections
    await this.connectionManager.closeAll(timeout);

    // Close server
    return new Promise((resolve) => {
      this.server!.close(() => {
        logger.info('TCP server stopped');
        this.server = null;
        this.startedAt = null;
        this.isShuttingDown = false;
        this.emit('stopped');
        resolve();
      });
    });
  }

  /**
   * Handle new TCP connection
   *
   * @param socket - TCP socket
   */
  private handleConnection(socket: net.Socket): void {
    if (this.isShuttingDown) {
      socket.destroy();
      return;
    }

    let connectionId: string | null = null;
    let parser: FrameParser | null = null;

    try {
      // Add connection to manager
      const result = this.connectionManager.addConnection(socket);
      connectionId = result.id;
      parser = new FrameParser({
        maxFrameSize: this.config.maxFrameSize,
      });

      const remoteAddress = socket.remoteAddress || 'unknown';
      const remotePort = socket.remotePort || 0;

      logger.info(
        {
          connectionId,
          remoteAddress,
          remotePort,
        },
        'TCP connection accepted'
      );

      this.emit('connection', connectionId, remoteAddress);

      // Handle incoming data
      socket.on('data', (chunk: Buffer) => {
        if (!connectionId || !parser) return;

        try {
          this.connectionManager.updateActivity(connectionId);

          // Parse frames from chunk
          const frames = parser.feed(chunk);

          // Process each frame
          for (const frame of frames) {
            try {
              const message = this.codec.decode(frame);
              this.emit('message', connectionId, message.type, message.data);
            } catch (error) {
              logger.error(
                { error, connectionId, frameType: frame.type },
                'Failed to decode TCP frame'
              );

              // Send error response
              this.sendError(
                connectionId,
                'Invalid message format',
                ErrorCode.TCP_INVALID_FRAME
              );
            }
          }
        } catch (error) {
          logger.error({ error, connectionId }, 'Failed to parse TCP frames');

          // Protocol error - close connection
          this.sendError(connectionId, 'Protocol error', ErrorCode.TCP_PROTOCOL_ERROR);
          socket.destroy();
        }
      });

      // Handle connection close
      socket.on('close', () => {
        if (connectionId) {
          logger.info({ connectionId }, 'TCP connection closed');
          this.connectionManager.removeConnection(connectionId);
          this.emit('disconnect', connectionId);
        }
      });

      // Handle socket errors
      socket.on('error', (error) => {
        logger.error({ error, connectionId }, 'TCP socket error');
        this.emit('error', error, connectionId || undefined);

        if (connectionId) {
          this.connectionManager.removeConnection(connectionId);
        }
      });

      // Set socket options
      socket.setNoDelay(true); // Disable Nagle's algorithm for low latency
      socket.setKeepAlive(true, this.config.keepAliveInterval);
    } catch (error) {
      logger.error({ error }, 'Failed to handle TCP connection');

      if (error instanceof ApiError && error.code === ErrorCode.TCP_CONNECTION_LIMIT) {
        // Send error and close
        try {
          const errorFrame = this.codec.encode({
            type: TcpMessageType.ERROR,
            data: {
              error: error.message,
              code: String(error.code),
            },
          });
          socket.write(errorFrame, () => {
            socket.destroy();
          });
        } catch {
          socket.destroy();
        }
      } else {
        socket.destroy();
      }

      if (connectionId) {
        this.connectionManager.removeConnection(connectionId);
      }
    }
  }

  /**
   * Send error message to connection
   *
   * @param connectionId - Connection ID
   * @param message - Error message
   * @param code - Error code
   */
  private sendError(connectionId: string, message: string, code: ErrorCode): void {
    try {
      const errorFrame = this.codec.encode({
        type: TcpMessageType.ERROR,
        data: {
          error: message,
          code: String(code),
        },
      });

      this.connectionManager.sendToConnection(connectionId, errorFrame);
    } catch (error) {
      logger.error({ error, connectionId }, 'Failed to send error message');
    }
  }

  /**
   * Start periodic ping interval
   */
  private startPingInterval(): void {
    this.pingIntervalHandle = setInterval(() => {
      const pingFrame = this.codec.encode({
        type: TcpMessageType.PING,
        data: {
          timestamp: Date.now(),
        },
      });

      const connectionIds = this.connectionManager.getAllConnectionIds();
      for (const connectionId of connectionIds) {
        const connection = this.connectionManager.getConnection(connectionId);
        if (connection?.userId) {
          // Only ping authenticated connections
          this.connectionManager.sendToConnection(connectionId, pingFrame);
        }
      }
    }, this.config.pingInterval);
  }

  /**
   * Start periodic stale connection check
   */
  private startStaleConnectionCheck(): void {
    const checkInterval = Math.min(this.config.pingTimeout, 60000); // Check at most every minute

    this.staleCheckIntervalHandle = setInterval(() => {
      const maxIdleTime = this.config.pingTimeout * 2; // Allow 2 missed pings
      const removed = this.connectionManager.removeStaleConnections(maxIdleTime);

      if (removed > 0) {
        logger.info({ count: removed }, 'Removed stale TCP connections');
      }
    }, checkInterval);
  }

  /**
   * Get server statistics
   *
   * @returns Server statistics
   */
  getStats(): TcpServerStats {
    const stats = this.connectionManager.getStats();

    if (this.startedAt) {
      stats.startedAt = this.startedAt;
      stats.uptime = Date.now() - this.startedAt.getTime();
    }

    return stats;
  }

  /**
   * Check if server is running
   *
   * @returns True if server is running
   */
  isRunning(): boolean {
    return this.server !== null && this.server.listening;
  }

  /**
   * Get connection manager (for message handler)
   *
   * @returns Connection manager instance
   */
  getConnectionManager(): ConnectionManager {
    return this.connectionManager;
  }

  /**
   * Get protocol codec (for message handler)
   *
   * @returns Protocol codec instance
   */
  getCodec(): ProtocolCodec {
    return this.codec;
  }
}

/**
 * Create a TCP server instance
 *
 * @param config - Application configuration
 * @returns TCP server instance
 */
export function createTcpServer(config: ValidatedConfig): TcpServer {
  return new TcpServer(config);
}

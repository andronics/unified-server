/**
 * TCP Message Handler
 * Layer 4: Application
 *
 * Processes incoming TCP messages and coordinates with business logic.
 * Handles authentication, subscriptions, and message routing.
 */

import { TcpServer } from './tcp-server';
import { ProtocolCodec } from './protocol-codec';
import { ConnectionManager } from './connection-manager';
import { TcpMessageType } from '@foundation/types/tcp-types';
import { ErrorCode } from '@foundation/errors/error-codes';
import { ApiError } from '@foundation/errors/api-error';
import { jwtService } from '@infrastructure/auth/jwt-service';
import { pubSubBroker } from '@infrastructure/pubsub/pubsub-broker';
import { userRepository } from '@integration/database/repositories/user-repository';
import { logger } from '@infrastructure/logging/logger';
import { z } from 'zod';

/**
 * Message validation schemas
 */
const AuthMessageSchema = z.object({
  token: z.string().min(1),
});

const SubscribeMessageSchema = z.object({
  topic: z.string().min(1).max(100),
});

const UnsubscribeMessageSchema = z.object({
  topic: z.string().min(1).max(100),
});

const PublishMessageSchema = z.object({
  topic: z.string().min(1).max(100),
  content: z.unknown(),
});

/**
 * TCP Message Handler
 * Routes and processes TCP protocol messages
 */
export class TcpMessageHandler {
  private readonly server: TcpServer;
  private readonly codec: ProtocolCodec;
  private readonly connectionManager: ConnectionManager;
  private readonly pubSubSubscriptions: Map<string, Map<string, string>>; // connectionId -> topic -> subscriptionId

  // Statistics
  private stats = {
    messagesProcessed: 0,
    authAttempts: 0,
    authSuccesses: 0,
    authFailures: 0,
    subscriptions: 0,
    unsubscriptions: 0,
    messagesPublished: 0,
    errors: 0,
  };

  constructor(server: TcpServer) {
    this.server = server;
    this.codec = server.getCodec();
    this.connectionManager = server.getConnectionManager();
    this.pubSubSubscriptions = new Map();

    // Register message handler
    this.server.on('message', (connectionId, type, data) => {
      this.handleMessage(connectionId, type, data);
    });

    // Clean up subscriptions on disconnect
    this.server.on('disconnect', (connectionId) => {
      this.cleanupSubscriptions(connectionId);
    });

    logger.info('TCP message handler initialized');
  }

  /**
   * Handle incoming TCP message
   *
   * @param connectionId - Connection ID
   * @param type - Message type
   * @param data - Message data
   */
  private async handleMessage(
    connectionId: string,
    type: TcpMessageType,
    data: unknown
  ): Promise<void> {
    this.stats.messagesProcessed++;

    try {
      logger.debug(
        {
          connectionId,
          type: TcpMessageType[type],
          data,
        },
        'Processing TCP message'
      );

      switch (type) {
        case TcpMessageType.AUTH:
          await this.handleAuth(connectionId, data);
          break;

        case TcpMessageType.SUBSCRIBE:
          await this.handleSubscribe(connectionId, data);
          break;

        case TcpMessageType.UNSUBSCRIBE:
          await this.handleUnsubscribe(connectionId, data);
          break;

        case TcpMessageType.MESSAGE:
          await this.handlePublish(connectionId, data);
          break;

        case TcpMessageType.PONG:
          this.handlePong(connectionId);
          break;

        case TcpMessageType.PING:
          this.handlePing(connectionId);
          break;

        default:
          logger.warn({ connectionId, type }, 'Unknown TCP message type');
          this.sendError(
            connectionId,
            'Unknown message type',
            ErrorCode.TCP_INVALID_MESSAGE_TYPE
          );
          this.stats.errors++;
      }
    } catch (error) {
      logger.error({ error, connectionId, type }, 'Failed to handle TCP message');
      this.stats.errors++;

      if (error instanceof ApiError) {
        this.sendError(connectionId, error.message, error.code);
      } else {
        this.sendError(connectionId, 'Internal server error', ErrorCode.INTERNAL_ERROR);
      }
    }
  }

  /**
   * Handle authentication message
   *
   * @param connectionId - Connection ID
   * @param data - Auth message data
   */
  private async handleAuth(connectionId: string, data: unknown): Promise<void> {
    this.stats.authAttempts++;

    const connection = this.connectionManager.getConnection(connectionId);
    if (!connection) {
      logger.warn({ connectionId }, 'Connection not found for auth');
      return;
    }

    // Already authenticated
    if (connection.userId) {
      logger.warn({ connectionId, userId: connection.userId }, 'Connection already authenticated');
      this.sendError(connectionId, 'Already authenticated', ErrorCode.CONFLICT);
      return;
    }

    try {
      // Validate message
      const authData = AuthMessageSchema.parse(data);

      // Verify JWT token
      const payload = jwtService.verifyToken(authData.token);
      const user = await userRepository.findById(payload.userId);

      if (!user) {
        throw ApiError.notFound('User not found');
      }

      // Authenticate connection
      this.connectionManager.authenticateConnection(connectionId, user.id, {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });

      // Send success response
      const response = this.codec.encode({
        type: TcpMessageType.AUTH_SUCCESS,
        data: {
          userId: user.id,
          message: 'Authentication successful',
        },
      });

      this.connectionManager.sendToConnection(connectionId, response);
      this.stats.authSuccesses++;

      logger.info(
        {
          connectionId,
          userId: user.id,
          email: user.email,
        },
        'TCP connection authenticated'
      );
    } catch (error) {
      this.stats.authFailures++;

      if (error instanceof z.ZodError) {
        logger.warn({ connectionId, errors: error.errors }, 'Invalid auth message');
        this.sendError(connectionId, 'Invalid auth data', ErrorCode.VALIDATION_ERROR);
      } else if (error instanceof ApiError) {
        logger.warn({ connectionId, error: error.message }, 'Authentication failed');
        this.sendError(connectionId, error.message, error.code);
      } else {
        logger.error({ connectionId, error }, 'Auth error');
        this.sendError(connectionId, 'Authentication failed', ErrorCode.UNAUTHORIZED);
      }
    }
  }

  /**
   * Handle subscription message
   *
   * @param connectionId - Connection ID
   * @param data - Subscribe message data
   */
  private async handleSubscribe(connectionId: string, data: unknown): Promise<void> {
    const connection = this.connectionManager.getConnection(connectionId);
    if (!connection) {
      logger.warn({ connectionId }, 'Connection not found for subscribe');
      return;
    }

    // Must be authenticated
    if (!connection.userId) {
      this.sendError(connectionId, 'Authentication required', ErrorCode.UNAUTHORIZED);
      return;
    }

    try {
      // Validate message
      const subData = SubscribeMessageSchema.parse(data);

      // Check if already subscribed
      const connectionSubs = this.pubSubSubscriptions.get(connectionId) || new Map();
      if (connectionSubs.has(subData.topic)) {
        logger.warn({ connectionId, topic: subData.topic }, 'Already subscribed to topic');
        this.sendError(connectionId, 'Already subscribed', ErrorCode.CONFLICT);
        return;
      }

      // Subscribe to PubSub
      const subscriptionId = await pubSubBroker.subscribe(subData.topic, (message: any) => {
        // Forward PubSub message to TCP connection
        const tcpMessage = this.codec.encode({
          type: TcpMessageType.SERVER_MESSAGE,
          data: {
            topic: subData.topic,
            content: message.data,
            timestamp: message.timestamp,
          },
        });

        this.connectionManager.sendToConnection(connectionId, tcpMessage);
      });

      // Track subscription
      connectionSubs.set(subData.topic, subscriptionId);
      this.pubSubSubscriptions.set(connectionId, connectionSubs);
      this.connectionManager.addSubscription(connectionId, subData.topic, subscriptionId);
      this.stats.subscriptions++;

      // Send success response
      const response = this.codec.encode({
        type: TcpMessageType.SUBSCRIBED,
        data: {
          topic: subData.topic,
          subscriptionId,
        },
      });

      this.connectionManager.sendToConnection(connectionId, response);

      logger.info(
        {
          connectionId,
          userId: connection.userId,
          topic: subData.topic,
          subscriptionId,
        },
        'TCP subscription created'
      );
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn({ connectionId, errors: error.errors }, 'Invalid subscribe message');
        this.sendError(connectionId, 'Invalid subscribe data', ErrorCode.VALIDATION_ERROR);
      } else if (error instanceof ApiError) {
        logger.warn({ connectionId, error: error.message }, 'Subscribe failed');
        this.sendError(connectionId, error.message, error.code);
      } else {
        logger.error({ connectionId, error }, 'Subscribe error');
        this.sendError(connectionId, 'Subscribe failed', ErrorCode.INTERNAL_ERROR);
      }
    }
  }

  /**
   * Handle unsubscription message
   *
   * @param connectionId - Connection ID
   * @param data - Unsubscribe message data
   */
  private async handleUnsubscribe(connectionId: string, data: unknown): Promise<void> {
    const connection = this.connectionManager.getConnection(connectionId);
    if (!connection) {
      logger.warn({ connectionId }, 'Connection not found for unsubscribe');
      return;
    }

    // Must be authenticated
    if (!connection.userId) {
      this.sendError(connectionId, 'Authentication required', ErrorCode.UNAUTHORIZED);
      return;
    }

    try {
      // Validate message
      const unsubData = UnsubscribeMessageSchema.parse(data);

      // Get subscription ID
      const connectionSubs = this.pubSubSubscriptions.get(connectionId);
      const subscriptionId = connectionSubs?.get(unsubData.topic);

      if (!subscriptionId) {
        logger.warn({ connectionId, topic: unsubData.topic }, 'Not subscribed to topic');
        this.sendError(connectionId, 'Not subscribed', ErrorCode.NOT_FOUND);
        return;
      }

      // Unsubscribe from PubSub
      await pubSubBroker.unsubscribe(subscriptionId);

      // Remove from tracking
      connectionSubs!.delete(unsubData.topic);
      this.connectionManager.removeSubscription(connectionId, unsubData.topic);
      this.stats.unsubscriptions++;

      // Send success response
      const response = this.codec.encode({
        type: TcpMessageType.UNSUBSCRIBED,
        data: {
          topic: unsubData.topic,
        },
      });

      this.connectionManager.sendToConnection(connectionId, response);

      logger.info(
        {
          connectionId,
          userId: connection.userId,
          topic: unsubData.topic,
        },
        'TCP unsubscription removed'
      );
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn({ connectionId, errors: error.errors }, 'Invalid unsubscribe message');
        this.sendError(connectionId, 'Invalid unsubscribe data', ErrorCode.VALIDATION_ERROR);
      } else if (error instanceof ApiError) {
        logger.warn({ connectionId, error: error.message }, 'Unsubscribe failed');
        this.sendError(connectionId, error.message, error.code);
      } else {
        logger.error({ connectionId, error }, 'Unsubscribe error');
        this.sendError(connectionId, 'Unsubscribe failed', ErrorCode.INTERNAL_ERROR);
      }
    }
  }

  /**
   * Handle publish message
   *
   * @param connectionId - Connection ID
   * @param data - Publish message data
   */
  private async handlePublish(connectionId: string, data: unknown): Promise<void> {
    const connection = this.connectionManager.getConnection(connectionId);
    if (!connection) {
      logger.warn({ connectionId }, 'Connection not found for publish');
      return;
    }

    // Must be authenticated
    if (!connection.userId) {
      this.sendError(connectionId, 'Authentication required', ErrorCode.UNAUTHORIZED);
      return;
    }

    try {
      // Validate message
      const pubData = PublishMessageSchema.parse(data);

      // Publish to PubSub
      await pubSubBroker.publish(pubData.topic, {
        data: pubData.content,
        userId: connection.userId,
        timestamp: new Date().toISOString(),
      });

      this.stats.messagesPublished++;

      logger.debug(
        {
          connectionId,
          userId: connection.userId,
          topic: pubData.topic,
        },
        'TCP message published'
      );
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn({ connectionId, errors: error.errors }, 'Invalid publish message');
        this.sendError(connectionId, 'Invalid publish data', ErrorCode.VALIDATION_ERROR);
      } else if (error instanceof ApiError) {
        logger.warn({ connectionId, error: error.message }, 'Publish failed');
        this.sendError(connectionId, error.message, error.code);
      } else {
        logger.error({ connectionId, error }, 'Publish error');
        this.sendError(connectionId, 'Publish failed', ErrorCode.INTERNAL_ERROR);
      }
    }
  }

  /**
   * Handle PONG message
   *
   * @param connectionId - Connection ID
   */
  private handlePong(connectionId: string): void {
    // Update activity timestamp (already done by server)
    logger.trace({ connectionId }, 'Received PONG');
  }

  /**
   * Handle PING message (client-initiated)
   *
   * @param connectionId - Connection ID
   */
  private handlePing(connectionId: string): void {
    // Send PONG response
    const response = this.codec.encode({
      type: TcpMessageType.PONG,
      data: {
        timestamp: Date.now(),
      },
    });

    this.connectionManager.sendToConnection(connectionId, response);
    logger.trace({ connectionId }, 'Sent PONG response');
  }

  /**
   * Clean up subscriptions for a disconnected connection
   *
   * @param connectionId - Connection ID
   */
  private async cleanupSubscriptions(connectionId: string): Promise<void> {
    const connectionSubs = this.pubSubSubscriptions.get(connectionId);
    if (!connectionSubs) {
      return;
    }

    // Unsubscribe from all topics
    for (const [topic, subscriptionId] of connectionSubs) {
      try {
        await pubSubBroker.unsubscribe(subscriptionId);
        logger.debug({ connectionId, topic }, 'Cleaned up TCP subscription');
      } catch (error) {
        logger.error({ error, connectionId, topic }, 'Failed to cleanup subscription');
      }
    }

    this.pubSubSubscriptions.delete(connectionId);
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
   * Get handler statistics
   *
   * @returns Handler statistics
   */
  getStats(): typeof this.stats {
    return { ...this.stats };
  }
}

/**
 * Create a TCP message handler instance
 *
 * @param server - TCP server instance
 * @returns TCP message handler instance
 */
export function createTcpMessageHandler(server: TcpServer): TcpMessageHandler {
  return new TcpMessageHandler(server);
}

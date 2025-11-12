/**
 * WebSocket Message Handler
 * Layer 4: Application
 *
 * Routes and handles different types of WebSocket messages from clients.
 * Delegates to appropriate handlers based on message type.
 */

import {
  WebSocketConnection,
  WebSocketClientMessage,
  AuthMessage,
  SubscribeMessage,
  UnsubscribeMessage,
  ClientMessage,
  PingMessage,
  AuthSuccessMessage,
  AuthErrorMessage,
  SubscribedMessage,
  UnsubscribedMessage,
  ServerMessage,
  ErrorMessage,
  PongMessage,
} from '@shared/types/websocket-types';
import { ConnectionManager } from './connection-manager';
import { logger } from '@infrastructure/logging/logger';
import { jwtService } from '@domain/auth/jwt-service';
import { pubSubBroker } from '@infrastructure/pubsub/pubsub-broker';
import { ApiError } from '@shared/errors/api-error';

export class MessageHandler {
  private connectionManager: ConnectionManager;
  private pubSubSubscriptions: Map<string, Map<string, string>>; // connectionId -> topic -> subscriptionId

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
    this.pubSubSubscriptions = new Map();
  }

  /**
   * Main message routing handler
   */
  async handle(connection: WebSocketConnection, message: WebSocketClientMessage): Promise<void> {
    logger.debug(
      {
        connectionId: connection.id,
        userId: connection.userId,
        messageType: message.type,
      },
      'Handling WebSocket message'
    );

    try {
      switch (message.type) {
        case 'auth':
          await this.handleAuth(connection, message as AuthMessage);
          break;

        case 'subscribe':
          await this.handleSubscribe(connection, message as SubscribeMessage);
          break;

        case 'unsubscribe':
          await this.handleUnsubscribe(connection, message as UnsubscribeMessage);
          break;

        case 'message':
          await this.handleClientMessage(connection, message as ClientMessage);
          break;

        case 'ping':
          await this.handlePing(connection, message as PingMessage);
          break;

        default:
          logger.warn(
            {
              connectionId: connection.id,
              messageType: (message as any).type,
            },
            'Unknown message type'
          );
          this.sendError(connection.id, 3, 'Unknown message type');
      }
    } catch (error) {
      logger.error(
        {
          error,
          connectionId: connection.id,
          messageType: message.type,
        },
        'Error handling message'
      );

      if (error instanceof ApiError) {
        this.sendError(connection.id, error.httpStatus, error.message);
      } else {
        this.sendError(connection.id, 1, 'Internal server error');
      }
    }
  }

  /**
   * Handle authentication message
   */
  private async handleAuth(connection: WebSocketConnection, message: AuthMessage): Promise<void> {
    try {
      // Verify JWT token
      const payload = jwtService.verifyToken(message.token);

      if (!payload || !payload.userId) {
        throw ApiError.unauthorized('Invalid token');
      }

      // Authenticate connection
      this.connectionManager.authenticateConnection(connection.id, payload.userId);

      // Send success response
      const response: AuthSuccessMessage = {
        type: 'auth_success',
        userId: payload.userId,
        timestamp: new Date().toISOString(),
      };

      this.connectionManager.sendToConnection(connection.id, response);

      logger.info(
        {
          connectionId: connection.id,
          userId: payload.userId,
        },
        'WebSocket connection authenticated'
      );
    } catch (error) {
      logger.error(
        {
          error,
          connectionId: connection.id,
        },
        'Authentication failed'
      );

      const response: AuthErrorMessage = {
        type: 'auth_error',
        message: error instanceof ApiError ? error.message : 'Authentication failed',
        code: error instanceof ApiError ? error.httpStatus : 401,
        timestamp: new Date().toISOString(),
      };

      this.connectionManager.sendToConnection(connection.id, response);
    }
  }

  /**
   * Handle subscribe to topic message
   */
  private async handleSubscribe(
    connection: WebSocketConnection,
    message: SubscribeMessage
  ): Promise<void> {
    // Authentication required for subscriptions
    if (!connection.userId) {
      throw ApiError.unauthorized('Authentication required for subscriptions');
    }

    const { topic } = message;

    logger.info(
      {
        connectionId: connection.id,
        userId: connection.userId,
        topic,
      },
      'Subscribing to topic'
    );

    // Subscribe in connection manager
    this.connectionManager.subscribe(connection.id, topic);

    // Get or create subscription map for this connection
    if (!this.pubSubSubscriptions.has(connection.id)) {
      this.pubSubSubscriptions.set(connection.id, new Map());
    }
    const connectionSubs = this.pubSubSubscriptions.get(connection.id)!;

    // Subscribe to PubSub for this topic (if not already subscribed)
    if (!connectionSubs.has(topic)) {
      const subscriptionId = await pubSubBroker.subscribe(topic, async (pubSubMessage) => {
        // Forward PubSub messages to WebSocket connection
        const wsMessage: ServerMessage = {
          type: 'message',
          topic: pubSubMessage.topic,
          data: pubSubMessage.data,
          metadata: pubSubMessage.metadata,
          timestamp: new Date().toISOString(),
        };

        this.connectionManager.sendToConnection(connection.id, wsMessage);
      });

      connectionSubs.set(topic, subscriptionId);
    }

    // Send confirmation
    const response: SubscribedMessage = {
      type: 'subscribed',
      topic,
      timestamp: new Date().toISOString(),
    };

    this.connectionManager.sendToConnection(connection.id, response);
  }

  /**
   * Handle unsubscribe from topic message
   */
  private async handleUnsubscribe(
    connection: WebSocketConnection,
    message: UnsubscribeMessage
  ): Promise<void> {
    const { topic } = message;

    logger.info(
      {
        connectionId: connection.id,
        userId: connection.userId,
        topic,
      },
      'Unsubscribing from topic'
    );

    // Unsubscribe in connection manager
    this.connectionManager.unsubscribe(connection.id, topic);

    // If unsubscribing from a specific topic, remove it from PubSub
    const connectionSubs = this.pubSubSubscriptions.get(connection.id);
    if (connectionSubs) {
      const subscriptionId = connectionSubs.get(topic);
      if (subscriptionId) {
        await pubSubBroker.unsubscribe(subscriptionId);
        connectionSubs.delete(topic);
        logger.debug({ connectionId: connection.id, topic }, 'Unsubscribed from PubSub topic');
      }

      // If no more subscriptions for this connection, clean up the map entry
      if (connectionSubs.size === 0) {
        this.pubSubSubscriptions.delete(connection.id);
      }
    }

    // Send confirmation
    const response: UnsubscribedMessage = {
      type: 'unsubscribed',
      topic,
      timestamp: new Date().toISOString(),
    };

    this.connectionManager.sendToConnection(connection.id, response);
  }

  /**
   * Handle client message to be broadcast to topic
   */
  private async handleClientMessage(
    connection: WebSocketConnection,
    message: ClientMessage
  ): Promise<void> {
    // Authentication required for sending messages
    if (!connection.userId) {
      throw ApiError.unauthorized('Authentication required for sending messages');
    }

    const { topic, data, metadata } = message;

    logger.info(
      {
        connectionId: connection.id,
        userId: connection.userId,
        topic,
      },
      'Publishing message to topic'
    );

    // Publish to PubSub (which will broadcast to all subscribers)
    await pubSubBroker.publish(topic, data, {
      ...metadata,
      senderId: connection.userId,
      senderConnectionId: connection.id,
    });

    logger.debug(
      {
        connectionId: connection.id,
        userId: connection.userId,
        topic,
      },
      'Message published successfully'
    );
  }

  /**
   * Handle ping message
   */
  private async handlePing(connection: WebSocketConnection, _message: PingMessage): Promise<void> {
    const response: PongMessage = {
      type: 'pong',
      timestamp: new Date().toISOString(),
    };

    this.connectionManager.sendToConnection(connection.id, response);
  }

  /**
   * Send error message to connection
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
   * Cleanup handler when connection is removed
   */
  async cleanup(connectionId: string): Promise<void> {
    // Unsubscribe from all PubSub topics for this connection
    const connectionSubs = this.pubSubSubscriptions.get(connectionId);
    if (connectionSubs) {
      for (const [topic, subscriptionId] of connectionSubs) {
        await pubSubBroker.unsubscribe(subscriptionId);
        logger.debug({ connectionId, topic }, 'Unsubscribed from topic');
      }
      this.pubSubSubscriptions.delete(connectionId);

      logger.debug({ connectionId }, 'Cleaned up all PubSub subscriptions for connection');
    }
  }
}

// Export singleton instance (will be created when needed)
export let messageHandler: MessageHandler | null = null;

export function initializeMessageHandler(connectionManager: ConnectionManager): MessageHandler {
  messageHandler = new MessageHandler(connectionManager);
  return messageHandler;
}

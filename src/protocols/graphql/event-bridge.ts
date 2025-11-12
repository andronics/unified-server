/**
 * Event Bridge - Bridges EventBus to PubSub for GraphQL Subscriptions
 * Layer 4: Application
 *
 * Listens to EventBus events and publishes them to PubSub topics
 * so that GraphQL subscriptions can receive real-time updates
 */

import { eventBus } from '@infrastructure/events/event-bus';
import { pubSubBroker } from '@infrastructure/pubsub/pubsub-broker';
import { logger } from '@infrastructure/logging/logger';
import type { AppEvent } from '@shared/types/event-types';

// Track whether the event bridge has been initialized to prevent duplicate listeners
let isInitialized = false;

/**
 * Initialize the event bridge
 * Sets up EventBus listeners that forward events to PubSub
 */
export function initializeEventBridge(): void {
  if (isInitialized) {
    logger.debug('GraphQL event bridge already initialized, skipping');
    return;
  }

  logger.info('Initializing GraphQL event bridge');
  isInitialized = true;

  // Bridge user.created events
  eventBus.on('user.created', async (event: AppEvent) => {
    try {
      logger.debug({ event }, 'Bridging user.created to PubSub');

      await pubSubBroker.publish('users', event.data, {
        eventType: event.eventType,
        eventId: event.eventId,
        timestamp: event.timestamp.toISOString(),
      });

      logger.debug('Successfully bridged user.created event');
    } catch (error) {
      logger.error({ error, event }, 'Failed to bridge user.created event');
    }
  });

  // Bridge user.updated events
  eventBus.on('user.updated', async (event: AppEvent) => {
    try {
      logger.debug({ event }, 'Bridging user.updated to PubSub');

      // Publish to general users topic
      await pubSubBroker.publish('users', event.data, {
        eventType: event.eventType,
        eventId: event.eventId,
        timestamp: event.timestamp.toISOString(),
      });

      // Also publish to user-specific topic if userId available
      const userId = (event.data as any).userId || (event.data as any).user?.id;
      if (userId) {
        await pubSubBroker.publish(`users.${userId}`, event.data, {
          eventType: event.eventType,
          eventId: event.eventId,
          timestamp: event.timestamp.toISOString(),
        });
      }

      logger.debug({ userId }, 'Successfully bridged user.updated event');
    } catch (error) {
      logger.error({ error, event }, 'Failed to bridge user.updated event');
    }
  });

  // Bridge user.deleted events
  eventBus.on('user.deleted', async (event: AppEvent) => {
    try {
      logger.debug({ event }, 'Bridging user.deleted to PubSub');

      // Publish to general users topic
      await pubSubBroker.publish('users', event.data, {
        eventType: event.eventType,
        eventId: event.eventId,
        timestamp: event.timestamp.toISOString(),
      });

      // Also publish to user-specific topic if userId available
      const userId = (event.data as any).userId;
      if (userId) {
        await pubSubBroker.publish(`users.${userId}`, event.data, {
          eventType: event.eventType,
          eventId: event.eventId,
          timestamp: event.timestamp.toISOString(),
        });
      }

      logger.debug({ userId }, 'Successfully bridged user.deleted event');
    } catch (error) {
      logger.error({ error, event }, 'Failed to bridge user.deleted event');
    }
  });

  // Bridge message.sent events
  eventBus.on('message.sent', async (event: AppEvent) => {
    try {
      logger.debug({ event }, 'Bridging message.sent to PubSub');

      const messageData = event.data as any;
      const message = messageData.message || messageData;

      // Publish to general messages topic
      await pubSubBroker.publish('messages', event.data, {
        eventType: event.eventType,
        eventId: event.eventId,
        timestamp: event.timestamp.toISOString(),
      });

      // Publish to channel-specific topic if channelId available
      if (message.channelId) {
        await pubSubBroker.publish(`messages.channel.${message.channelId}`, event.data, {
          eventType: event.eventType,
          eventId: event.eventId,
          timestamp: event.timestamp.toISOString(),
        });
      }

      // Publish to user-specific topic if recipientId available
      if (message.recipientId) {
        await pubSubBroker.publish(`messages.user.${message.recipientId}`, event.data, {
          eventType: event.eventType,
          eventId: event.eventId,
          timestamp: event.timestamp.toISOString(),
        });
      }

      logger.debug(
        { channelId: message.channelId, recipientId: message.recipientId },
        'Successfully bridged message.sent event'
      );
    } catch (error) {
      logger.error({ error, event }, 'Failed to bridge message.sent event');
    }
  });

  logger.info('GraphQL event bridge initialized with 4 event listeners');
}

/**
 * Clean up event bridge subscriptions
 */
export function cleanupEventBridge(): void {
  logger.info('Cleaning up GraphQL event bridge');
  isInitialized = false;
  // EventBus subscriptions are automatically cleaned up when the app shuts down
  // No additional cleanup needed here
}

/**
 * Reset initialization state (for testing)
 */
export function resetEventBridge(): void {
  isInitialized = false;
}

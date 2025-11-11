/**
 * Event Bridge - Connect EventBus to WebSocket via PubSub
 * Layer 4: Application
 *
 * Listens to EventBus events and publishes them to PubSub,
 * which then broadcasts to WebSocket clients subscribed to topics.
 */

import { EventBus } from '@infrastructure/events/event-bus';
import { PubSubBroker } from '@infrastructure/pubsub/pubsub-broker';
import { MessageSentEvent } from '@foundation/types/event-types';
import { logger } from '@infrastructure/logging/logger';
import { userRepository } from '@integration/database/repositories/user-repository';

export class EventBridge {
  private eventBus: EventBus;
  private pubSubBroker: PubSubBroker;

  constructor(eventBus: EventBus, pubSubBroker: PubSubBroker) {
    this.eventBus = eventBus;
    this.pubSubBroker = pubSubBroker;
  }

  /**
   * Start the event bridge (subscribe to events)
   */
  async start(): Promise<void> {
    logger.info('Starting event bridge (EventBus → PubSub → WebSocket)');

    // Subscribe to all relevant events
    this.eventBus.on('message.sent', this.handleMessageSent.bind(this));
    this.eventBus.on('user.created', this.handleUserCreated.bind(this));
    this.eventBus.on('user.updated', this.handleUserUpdated.bind(this));

    logger.info('✓ Event bridge started');
  }

  /**
   * Stop the event bridge (unsubscribe from events)
   */
  async stop(): Promise<void> {
    logger.info('Stopping event bridge');

    // EventBus doesn't have unsubscribe, so we just clear references
    // In a production system, you'd want proper cleanup

    logger.info('Event bridge stopped');
  }

  /**
   * Handle user.created event from EventBus
   */
  private async handleUserCreated(event: any): Promise<void> {
    try {
      const { user } = event.data;

      logger.debug(
        {
          userId: user.id,
          email: user.email,
        },
        'Broadcasting user.created event to WebSocket'
      );

      // Publish to users topic - preserve the event structure
      await this.pubSubBroker.publish('users', { user }, {
        eventType: 'user.created',
        eventId: event.eventId,
        timestamp: event.timestamp?.toISOString() || new Date().toISOString(),
      });

      logger.info({ userId: user.id }, 'User created event published');
    } catch (error) {
      logger.error({ error, event }, 'Failed to handle user.created event');
    }
  }

  /**
   * Handle user.updated event from EventBus
   */
  private async handleUserUpdated(event: any): Promise<void> {
    try {
      // user.updated has { userId, changes } structure
      // Fetch the full updated user object for consistency with frontend expectations
      const { userId, changes } = event.data;

      const updatedUser = await userRepository.findById(userId);
      if (!updatedUser) {
        logger.warn({ userId }, 'User not found for update event');
        return;
      }

      logger.debug(
        {
          userId,
          changes,
        },
        'Broadcasting user.updated event to WebSocket'
      );

      // Send full user object like we do with user.created
      const eventData = { user: updatedUser };

      // Publish to users topic and user-specific topic - preserve the event structure
      await this.pubSubBroker.publish('users', eventData, {
        eventType: 'user.updated',
        eventId: event.eventId,
        timestamp: event.timestamp?.toISOString() || new Date().toISOString(),
      });

      await this.pubSubBroker.publish(`users.${userId}`, eventData, {
        eventType: 'user.updated',
        eventId: event.eventId,
        timestamp: event.timestamp?.toISOString() || new Date().toISOString(),
      });

      logger.info({ userId }, 'User updated event published');
    } catch (error) {
      logger.error({ error, event }, 'Failed to handle user.updated event');
    }
  }

  /**
   * Handle message.sent event from EventBus
   */
  private async handleMessageSent(event: MessageSentEvent): Promise<void> {
    try {
      const { message } = event.data;

      logger.debug(
        {
          messageId: message.id,
          userId: message.userId,
          recipientId: message.recipientId,
          channelId: message.channelId,
        },
        'Broadcasting message.sent event to WebSocket'
      );

      // Determine topics to publish to based on message type
      const topics: string[] = [];

      // Always publish to general messages topic
      topics.push('messages');

      // Publish to user-specific topic (for sender)
      if (message.userId) {
        topics.push(`messages.user.${message.userId}`);
      }

      // Publish to recipient-specific topic (for direct messages)
      if (message.recipientId) {
        topics.push(`messages.user.${message.recipientId}`);
      }

      // Publish to channel-specific topic (for channel messages)
      if (message.channelId) {
        topics.push(`messages.channel.${message.channelId}`);
      }

      // Publish to all relevant topics - preserve the event structure
      for (const topic of topics) {
        await this.pubSubBroker.publish(topic, { message }, {
          eventType: 'message.sent',
          eventId: event.eventId,
          timestamp: event.timestamp.toISOString(),
        });

        logger.debug({ topic, messageId: message.id }, 'Published to topic');
      }

      logger.info(
        {
          messageId: message.id,
          topicCount: topics.length,
          topics,
        },
        'Message broadcast to WebSocket topics'
      );
    } catch (error) {
      logger.error(
        {
          error,
          event,
        },
        'Failed to broadcast message.sent event'
      );
    }
  }
}

// Export singleton instance (will be initialized in server.ts)
export let eventBridge: EventBridge | null = null;

export function initializeEventBridge(
  eventBus: EventBus,
  pubSubBroker: PubSubBroker
): EventBridge {
  eventBridge = new EventBridge(eventBus, pubSubBroker);
  return eventBridge;
}

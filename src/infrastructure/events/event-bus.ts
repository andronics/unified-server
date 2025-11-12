/**
 * Simple event bus for internal events
 * Layer 2: Infrastructure
 *
 * This is a minimal event bus implementation that will evolve into
 * a full PubSub system when WebSocket support is added.
 */

import { v4 as uuidv4 } from 'uuid';
import { AppEvent, EventHandler, EventSubscription } from '@shared/types/event-types';
import { logger } from '../logging/logger';

/**
 * Event Bus for internal application events
 */
export class EventBus {
  private subscriptions: Map<string, Map<string, EventSubscription>>;

  constructor() {
    this.subscriptions = new Map();
  }

  /**
   * Subscribe to an event type
   * @param eventType - Type of event to subscribe to
   * @param handler - Handler function to call when event is emitted
   * @returns Subscription ID (used for unsubscribing)
   */
  on<T extends AppEvent = AppEvent>(
    eventType: T['eventType'],
    handler: EventHandler<T>
  ): string {
    const subscriptionId = uuidv4();

    // Get or create subscription map for this event type
    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, new Map());
    }

    const eventSubscriptions = this.subscriptions.get(eventType)!;

    // Add subscription
    eventSubscriptions.set(subscriptionId, {
      id: subscriptionId,
      eventType,
      handler: handler as EventHandler,
      createdAt: new Date(),
    });

    logger.debug(
      {
        eventType,
        subscriptionId,
        totalSubscriptions: eventSubscriptions.size,
      },
      'Event subscription added'
    );

    return subscriptionId;
  }

  /**
   * Unsubscribe from an event
   * @param subscriptionId - ID returned from on()
   */
  off(subscriptionId: string): void {
    let found = false;

    // Search through all event types
    for (const [eventType, eventSubscriptions] of this.subscriptions.entries()) {
      if (eventSubscriptions.has(subscriptionId)) {
        eventSubscriptions.delete(subscriptionId);
        found = true;

        logger.debug(
          {
            eventType,
            subscriptionId,
            remainingSubscriptions: eventSubscriptions.size,
          },
          'Event subscription removed'
        );

        // Clean up empty event type maps
        if (eventSubscriptions.size === 0) {
          this.subscriptions.delete(eventType);
        }

        break;
      }
    }

    if (!found) {
      logger.warn({ subscriptionId }, 'Attempted to remove non-existent subscription');
    }
  }

  /**
   * Emit an event to all subscribers
   * @param event - Event to emit
   */
  async emit<T extends AppEvent>(event: T): Promise<void> {
    const eventSubscriptions = this.subscriptions.get(event.eventType);

    if (!eventSubscriptions || eventSubscriptions.size === 0) {
      logger.debug(
        {
          eventType: event.eventType,
          eventId: event.eventId,
        },
        'Event emitted but no subscribers'
      );
      return;
    }

    logger.debug(
      {
        eventType: event.eventType,
        eventId: event.eventId,
        subscriberCount: eventSubscriptions.size,
      },
      'Emitting event to subscribers'
    );

    // Execute all handlers
    const handlers = Array.from(eventSubscriptions.values());
    const results = await Promise.allSettled(
      handlers.map(async (subscription) => {
        try {
          await subscription.handler(event);
        } catch (error) {
          logger.error(
            {
              error,
              eventType: event.eventType,
              eventId: event.eventId,
              subscriptionId: subscription.id,
            },
            'Event handler failed'
          );
          throw error;
        }
      })
    );

    // Log any failures
    const failures = results.filter((r) => r.status === 'rejected');
    if (failures.length > 0) {
      logger.warn(
        {
          eventType: event.eventType,
          eventId: event.eventId,
          failureCount: failures.length,
          totalHandlers: handlers.length,
        },
        'Some event handlers failed'
      );
    }
  }

  /**
   * Get subscription count for an event type
   */
  getSubscriptionCount(eventType: string): number {
    return this.subscriptions.get(eventType)?.size || 0;
  }

  /**
   * Get all active event types
   */
  getActiveEventTypes(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * Get all subscriptions (useful for testing)
   */
  getSubscriptions(): EventSubscription[] {
    const allSubscriptions: EventSubscription[] = [];

    for (const eventSubscriptions of this.subscriptions.values()) {
      allSubscriptions.push(...Array.from(eventSubscriptions.values()));
    }

    return allSubscriptions;
  }

  /**
   * Clear all subscriptions (useful for testing)
   */
  clear(): void {
    const totalSubscriptions = Array.from(this.subscriptions.values()).reduce(
      (sum, subs) => sum + subs.size,
      0
    );

    this.subscriptions.clear();

    logger.debug(
      {
        clearedSubscriptions: totalSubscriptions,
      },
      'All event subscriptions cleared'
    );
  }

  /**
   * Alias for clear()
   */
  clearAll(): void {
    this.clear();
  }

  /**
   * Get stats about the event bus
   */
  getStats() {
    const eventTypes = Array.from(this.subscriptions.entries()).map(([eventType, subs]) => ({
      eventType,
      subscriptionCount: subs.size,
    }));

    const totalSubscriptions = eventTypes.reduce((sum, et) => sum + et.subscriptionCount, 0);

    return {
      totalEventTypes: eventTypes.length,
      totalSubscriptions,
      eventTypes,
    };
  }
}

// Export singleton instance
export const eventBus = new EventBus();

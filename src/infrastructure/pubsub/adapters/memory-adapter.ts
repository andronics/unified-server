/**
 * In-memory PubSub adapter
 * Layer 2: Infrastructure
 *
 * Simple in-process pub/sub implementation.
 * Used as default and fallback when Redis is unavailable.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  PubSubAdapter,
  PubSubMessage,
  PubSubHandler,
  PubSubSubscription,
} from '@shared/types/pubsub-types';
import { topicMatcher } from '../topic-matcher';
import { logger } from '@infrastructure/logging/logger';

export class MemoryAdapter implements PubSubAdapter {
  private subscriptions: Map<string, PubSubSubscription>;
  private connected: boolean;

  constructor(_maxMessages: number = 10000) {
    this.subscriptions = new Map();
    this.connected = false;
    // maxMessages parameter reserved for future use (message history/replay)
  }

  /**
   * Connect (no-op for memory adapter)
   */
  async connect(): Promise<void> {
    this.connected = true;
    logger.info('Memory PubSub adapter connected');
  }

  /**
   * Disconnect (cleanup subscriptions)
   */
  async disconnect(): Promise<void> {
    await this.clear();
    this.connected = false;
    logger.info('Memory PubSub adapter disconnected');
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Publish a message to a topic
   */
  async publish<T = any>(
    topic: string,
    data: T,
    metadata?: Record<string, any>
  ): Promise<string> {
    if (!this.connected) {
      throw new Error('Memory adapter not connected');
    }

    const messageId = uuidv4();
    const message: PubSubMessage<T> = {
      messageId,
      topic,
      data,
      publishedAt: new Date(),
      metadata,
    };

    logger.debug({ messageId, topic }, 'Publishing message to topic');

    // Find all matching subscriptions
    const matchingSubscriptions = Array.from(this.subscriptions.values()).filter((sub) =>
      topicMatcher.matches(topic, sub.topic)
    );

    if (matchingSubscriptions.length === 0) {
      logger.debug({ topic, messageId }, 'No subscribers for topic');
      return messageId;
    }

    logger.debug(
      {
        topic,
        messageId,
        subscriberCount: matchingSubscriptions.length,
      },
      'Delivering message to subscribers'
    );

    // Deliver message to all matching subscribers
    await Promise.allSettled(
      matchingSubscriptions.map(async (subscription) => {
        try {
          await subscription.handler(message);
        } catch (error) {
          logger.error(
            {
              error,
              messageId,
              topic,
              subscriptionId: subscription.id,
            },
            'Subscription handler failed'
          );
        }
      })
    );

    return messageId;
  }

  /**
   * Subscribe to a topic pattern
   */
  async subscribe<T = any>(topic: string, handler: PubSubHandler<T>): Promise<string> {
    if (!this.connected) {
      throw new Error('Memory adapter not connected');
    }

    const subscriptionId = uuidv4();

    const subscription: PubSubSubscription = {
      id: subscriptionId,
      topic,
      handler: handler as PubSubHandler,
      createdAt: new Date(),
    };

    this.subscriptions.set(subscriptionId, subscription);

    logger.debug(
      {
        subscriptionId,
        topic,
        totalSubscriptions: this.subscriptions.size,
      },
      'Subscription added'
    );

    return subscriptionId;
  }

  /**
   * Unsubscribe from a topic
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);

    if (!subscription) {
      logger.warn({ subscriptionId }, 'Attempted to unsubscribe non-existent subscription');
      return;
    }

    this.subscriptions.delete(subscriptionId);

    logger.debug(
      {
        subscriptionId,
        topic: subscription.topic,
        remainingSubscriptions: this.subscriptions.size,
      },
      'Subscription removed'
    );
  }

  /**
   * Unsubscribe all handlers for a topic
   */
  async unsubscribeAll(topic: string): Promise<void> {
    const matchingSubscriptions = Array.from(this.subscriptions.entries()).filter(([_, sub]) =>
      topicMatcher.matches(sub.topic, topic)
    );

    for (const [id] of matchingSubscriptions) {
      this.subscriptions.delete(id);
    }

    logger.debug(
      {
        topic,
        removedCount: matchingSubscriptions.length,
      },
      'Unsubscribed all handlers for topic'
    );
  }

  /**
   * Get all active subscriptions
   */
  getSubscriptions(): PubSubSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Get subscription count for a topic
   */
  getSubscriptionCount(topic: string): number {
    return Array.from(this.subscriptions.values()).filter((sub) =>
      topicMatcher.matches(sub.topic, topic)
    ).length;
  }

  /**
   * Clear all subscriptions
   */
  async clear(): Promise<void> {
    const count = this.subscriptions.size;
    this.subscriptions.clear();

    logger.debug({ clearedSubscriptions: count }, 'All subscriptions cleared');
  }

  /**
   * Get adapter statistics
   */
  getStats() {
    const topics = new Map<string, number>();

    // Count subscriptions per topic
    for (const sub of this.subscriptions.values()) {
      const count = topics.get(sub.topic) || 0;
      topics.set(sub.topic, count + 1);
    }

    const topicStats = Array.from(topics.entries()).map(([topic, subscriptionCount]) => ({
      topic,
      subscriptionCount,
    }));

    return {
      connected: this.connected,
      totalSubscriptions: this.subscriptions.size,
      totalTopics: topics.size,
      topics: topicStats,
    };
  }
}

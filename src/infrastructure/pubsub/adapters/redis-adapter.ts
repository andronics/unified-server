/**
 * Redis PubSub adapter
 * Layer 2: Infrastructure
 *
 * Production-ready pub/sub implementation using Redis.
 * Supports multi-instance deployments with Redis as message broker.
 */

import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import {
  PubSubAdapter,
  PubSubMessage,
  PubSubHandler,
  PubSubSubscription,
} from '@shared/types/pubsub-types';
import { topicMatcher } from '../topic-matcher';
import { logger } from '@infrastructure/logging/logger';

export interface RedisAdapterConfig {
  url: string;
  prefix?: string;
  retryStrategy?: (times: number) => number | void;
}

export class RedisAdapter implements PubSubAdapter {
  private publisher: Redis;
  private subscriber: Redis;
  private subscriptions: Map<string, PubSubSubscription>;
  private redisSubscriptions: Map<string, Set<string>>; // topic -> subscription IDs
  private config: RedisAdapterConfig;
  private connected: boolean;

  constructor(config: RedisAdapterConfig) {
    this.config = {
      prefix: 'pubsub:',
      ...config,
    };

    this.subscriptions = new Map();
    this.redisSubscriptions = new Map();
    this.connected = false;

    // Create two separate Redis connections (pub/sub pattern)
    const redisOptions = {
      retryStrategy: config.retryStrategy || ((times: number) => Math.min(times * 50, 2000)),
      lazyConnect: true,
    };

    this.publisher = new Redis(config.url, redisOptions);
    this.subscriber = new Redis(config.url, redisOptions);

    this.setupEventHandlers();
  }

  /**
   * Setup Redis event handlers
   */
  private setupEventHandlers(): void {
    // Publisher events
    this.publisher.on('connect', () => {
      logger.info('Redis publisher connected');
    });

    this.publisher.on('error', (error) => {
      logger.error({ error }, 'Redis publisher error');
    });

    // Subscriber events
    this.subscriber.on('connect', () => {
      logger.info('Redis subscriber connected');
    });

    this.subscriber.on('error', (error) => {
      logger.error({ error }, 'Redis subscriber error');
    });

    // Handle incoming messages
    this.subscriber.on('pmessage', async (pattern: string, channel: string, messageStr: string) => {
      try {
        const message: PubSubMessage = JSON.parse(messageStr);
        const topic = this.removePrefix(channel);

        logger.debug(
          {
            pattern,
            topic,
            messageId: message.messageId,
          },
          'Received message from Redis'
        );

        // Find matching subscriptions
        const subscriptionIds = this.redisSubscriptions.get(pattern) || new Set();

        for (const subscriptionId of subscriptionIds) {
          const subscription = this.subscriptions.get(subscriptionId);

          if (subscription) {
            try {
              await subscription.handler(message);
            } catch (error) {
              logger.error(
                {
                  error,
                  messageId: message.messageId,
                  topic,
                  subscriptionId,
                },
                'Subscription handler failed'
              );
            }
          }
        }
      } catch (error) {
        logger.error({ error, channel }, 'Failed to process Redis message');
      }
    });
  }

  /**
   * Add prefix to topic
   */
  private addPrefix(topic: string): string {
    return `${this.config.prefix}${topic}`;
  }

  /**
   * Remove prefix from topic
   */
  private removePrefix(topic: string): string {
    return topic.startsWith(this.config.prefix!)
      ? topic.substring(this.config.prefix!.length)
      : topic;
  }

  /**
   * Convert topic pattern to Redis pattern
   * messages.* → messages.*
   * messages.** → messages.*
   */
  private toRedisPattern(topic: string): string {
    return this.addPrefix(topic.replace(/\*\*/g, '*'));
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    try {
      await Promise.all([this.publisher.connect(), this.subscriber.connect()]);

      this.connected = true;

      logger.info(
        {
          url: this.config.url,
          prefix: this.config.prefix,
        },
        'Redis PubSub adapter connected'
      );
    } catch (error) {
      logger.error({ error }, 'Failed to connect to Redis');
      throw error;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    try {
      await this.clear();
      await Promise.all([this.publisher.quit(), this.subscriber.quit()]);

      this.connected = false;

      logger.info('Redis PubSub adapter disconnected');
    } catch (error) {
      logger.error({ error }, 'Error disconnecting from Redis');
      throw error;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected && this.publisher.status === 'ready' && this.subscriber.status === 'ready';
  }

  /**
   * Publish a message to a topic
   */
  async publish<T = any>(
    topic: string,
    data: T,
    metadata?: Record<string, any>
  ): Promise<string> {
    if (!this.isConnected()) {
      throw new Error('Redis adapter not connected');
    }

    const messageId = uuidv4();
    const message: PubSubMessage<T> = {
      messageId,
      topic,
      data,
      publishedAt: new Date(),
      metadata,
    };

    const channel = this.addPrefix(topic);
    const messageStr = JSON.stringify(message);

    try {
      await this.publisher.publish(channel, messageStr);

      logger.debug(
        {
          messageId,
          topic,
          channel,
        },
        'Published message to Redis'
      );

      return messageId;
    } catch (error) {
      logger.error({ error, topic, messageId }, 'Failed to publish message to Redis');
      throw error;
    }
  }

  /**
   * Subscribe to a topic pattern
   */
  async subscribe<T = any>(topic: string, handler: PubSubHandler<T>): Promise<string> {
    if (!this.isConnected()) {
      throw new Error('Redis adapter not connected');
    }

    const subscriptionId = uuidv4();
    const pattern = this.toRedisPattern(topic);

    // Create subscription record
    const subscription: PubSubSubscription = {
      id: subscriptionId,
      topic,
      handler: handler as PubSubHandler,
      createdAt: new Date(),
    };

    this.subscriptions.set(subscriptionId, subscription);

    // Track Redis pattern subscription
    if (!this.redisSubscriptions.has(pattern)) {
      this.redisSubscriptions.set(pattern, new Set());

      // Subscribe to pattern in Redis
      await this.subscriber.psubscribe(pattern);

      logger.debug({ pattern, topic }, 'Subscribed to Redis pattern');
    }

    this.redisSubscriptions.get(pattern)!.add(subscriptionId);

    logger.debug(
      {
        subscriptionId,
        topic,
        pattern,
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

    const pattern = this.toRedisPattern(subscription.topic);

    // Remove from tracking
    this.subscriptions.delete(subscriptionId);

    const subscriptionIds = this.redisSubscriptions.get(pattern);
    if (subscriptionIds) {
      subscriptionIds.delete(subscriptionId);

      // If no more subscriptions for this pattern, unsubscribe from Redis
      if (subscriptionIds.size === 0) {
        this.redisSubscriptions.delete(pattern);

        if (this.isConnected()) {
          await this.subscriber.punsubscribe(pattern);
          logger.debug({ pattern }, 'Unsubscribed from Redis pattern');
        }
      }
    }

    logger.debug(
      {
        subscriptionId,
        topic: subscription.topic,
        pattern,
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
      await this.unsubscribe(id);
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

    // Unsubscribe from all Redis patterns
    if (this.isConnected()) {
      const patterns = Array.from(this.redisSubscriptions.keys());

      if (patterns.length > 0) {
        await this.subscriber.punsubscribe(...patterns);
      }
    }

    this.subscriptions.clear();
    this.redisSubscriptions.clear();

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
      connected: this.isConnected(),
      totalSubscriptions: this.subscriptions.size,
      totalTopics: topics.size,
      topics: topicStats,
    };
  }
}

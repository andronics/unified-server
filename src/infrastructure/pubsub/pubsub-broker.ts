/**
 * PubSub Broker - Unified publish/subscribe messaging
 * Layer 2: Infrastructure
 *
 * Facade for publish/subscribe messaging with pluggable adapters.
 * Supports both in-memory and Redis-backed implementations.
 */

import {
  PubSubAdapter,
  PubSubConfig,
  PubSubHandler,
  PubSubSubscription,
} from '@foundation/types/pubsub-types';
import { MemoryAdapter } from './adapters/memory-adapter';
import { RedisAdapter } from './adapters/redis-adapter';
import { logger } from '@infrastructure/logging/logger';

export class PubSubBroker {
  private adapter: PubSubAdapter;
  private config: PubSubConfig;

  constructor(config: PubSubConfig) {
    this.config = config;
    this.adapter = this.createAdapter(config);
  }

  /**
   * Create adapter based on configuration
   */
  private createAdapter(config: PubSubConfig): PubSubAdapter {
    switch (config.adapter) {
      case 'redis':
        if (!config.redis) {
          throw new Error('Redis configuration required for redis adapter');
        }

        logger.info({ url: config.redis.url }, 'Creating Redis PubSub adapter');

        return new RedisAdapter({
          url: config.redis.url,
          prefix: config.redis.prefix,
          retryStrategy: config.redis.retryStrategy,
        });

      case 'memory':
      default:
        logger.info('Creating Memory PubSub adapter');

        return new MemoryAdapter(config.memory?.maxMessages);
    }
  }

  /**
   * Connect to the underlying message broker
   */
  async connect(): Promise<void> {
    try {
      await this.adapter.connect();
      logger.info({ adapter: this.config.adapter }, 'PubSub broker connected');
    } catch (error) {
      logger.error({ error, adapter: this.config.adapter }, 'Failed to connect PubSub broker');

      // Fallback to memory adapter on Redis failure
      if (this.config.adapter === 'redis') {
        logger.warn('Falling back to memory adapter');
        this.adapter = new MemoryAdapter();
        await this.adapter.connect();
      } else {
        throw error;
      }
    }
  }

  /**
   * Disconnect from the message broker
   */
  async disconnect(): Promise<void> {
    await this.adapter.disconnect();
    logger.info('PubSub broker disconnected');
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.adapter.isConnected();
  }

  /**
   * Publish a message to a topic
   * @param topic - Topic to publish to
   * @param data - Message data
   * @param metadata - Optional metadata
   * @returns Message ID
   *
   * @example
   * ```typescript
   * const messageId = await pubSubBroker.publish('messages.sent', {
   *   id: '123',
   *   content: 'Hello!',
   *   userId: '456'
   * });
   * ```
   */
  async publish<T = any>(topic: string, data: T, metadata?: Record<string, any>): Promise<string> {
    return this.adapter.publish(topic, data, metadata);
  }

  /**
   * Subscribe to a topic pattern
   * @param topic - Topic pattern (supports wildcards: *, **)
   * @param handler - Message handler
   * @returns Subscription ID
   *
   * @example
   * ```typescript
   * const subscriptionId = await pubSubBroker.subscribe('messages.*', (message) => {
   *   console.log('Received message:', message.data);
   * });
   * ```
   */
  async subscribe<T = any>(topic: string, handler: PubSubHandler<T>): Promise<string> {
    return this.adapter.subscribe(topic, handler);
  }

  /**
   * Unsubscribe from a topic
   * @param subscriptionId - Subscription ID from subscribe()
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    return this.adapter.unsubscribe(subscriptionId);
  }

  /**
   * Unsubscribe all handlers for a topic
   * @param topic - Topic pattern
   */
  async unsubscribeAll(topic: string): Promise<void> {
    return this.adapter.unsubscribeAll(topic);
  }

  /**
   * Get all active subscriptions
   */
  getSubscriptions(): PubSubSubscription[] {
    return this.adapter.getSubscriptions();
  }

  /**
   * Get subscription count for a topic
   */
  getSubscriptionCount(topic: string): number {
    return this.adapter.getSubscriptionCount(topic);
  }

  /**
   * Clear all subscriptions (useful for testing)
   */
  async clear(): Promise<void> {
    return this.adapter.clear();
  }

  /**
   * Get broker statistics
   */
  getStats() {
    return {
      adapter: this.config.adapter,
      ...this.adapter.getStats(),
    };
  }

  /**
   * Get current adapter type
   */
  getAdapterType(): 'memory' | 'redis' {
    return this.config.adapter;
  }
}

/**
 * Create PubSubBroker from environment variables
 */
export function createPubSubBroker(): PubSubBroker {
  const adapter = (process.env.PUBSUB_ADAPTER || 'memory') as 'memory' | 'redis';

  const config: PubSubConfig = {
    adapter,
    redis: adapter === 'redis' ? {
      url: process.env.PUBSUB_REDIS_URL || 'redis://localhost:6379',
      prefix: process.env.PUBSUB_REDIS_PREFIX || 'pubsub:',
    } : undefined,
    memory: {
      maxMessages: parseInt(process.env.PUBSUB_MEMORY_MAX_MESSAGES || '10000', 10),
    },
  };

  return new PubSubBroker(config);
}

// Export singleton instance
export const pubSubBroker = createPubSubBroker();

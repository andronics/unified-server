/**
 * PubSub types for publish/subscribe messaging
 * Layer 1: Foundation
 */

/**
 * Message published to a topic
 */
export interface PubSubMessage<T = any> {
  /** Unique message ID */
  messageId: string;

  /** Topic the message was published to */
  topic: string;

  /** Message payload */
  data: T;

  /** When the message was published */
  publishedAt: Date;

  /** Optional metadata */
  metadata?: Record<string, any>;
}

/**
 * Handler function for received messages
 */
export type PubSubHandler<T = any> = (message: PubSubMessage<T>) => void | Promise<void>;

/**
 * Subscription to a topic
 */
export interface PubSubSubscription {
  /** Unique subscription ID */
  id: string;

  /** Topic pattern (supports wildcards) */
  topic: string;

  /** Handler function */
  handler: PubSubHandler;

  /** When subscription was created */
  createdAt: Date;

  /** Optional subscription metadata */
  metadata?: Record<string, any>;
}

/**
 * PubSub adapter interface
 * Implementations: MemoryAdapter, RedisAdapter
 */
export interface PubSubAdapter {
  /**
   * Connect to the underlying message broker
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the message broker
   */
  disconnect(): Promise<void>;

  /**
   * Check if connected
   */
  isConnected(): boolean;

  /**
   * Publish a message to a topic
   * @param topic - Topic to publish to
   * @param data - Message data
   * @param metadata - Optional metadata
   * @returns Message ID
   */
  publish<T = any>(topic: string, data: T, metadata?: Record<string, any>): Promise<string>;

  /**
   * Subscribe to a topic pattern
   * @param topic - Topic pattern (supports wildcards: *, **)
   * @param handler - Message handler
   * @returns Subscription ID
   */
  subscribe<T = any>(topic: string, handler: PubSubHandler<T>): Promise<string>;

  /**
   * Unsubscribe from a topic
   * @param subscriptionId - Subscription ID from subscribe()
   */
  unsubscribe(subscriptionId: string): Promise<void>;

  /**
   * Unsubscribe all handlers for a topic
   * @param topic - Topic pattern
   */
  unsubscribeAll(topic: string): Promise<void>;

  /**
   * Get all active subscriptions
   */
  getSubscriptions(): PubSubSubscription[];

  /**
   * Get subscription count for a topic
   */
  getSubscriptionCount(topic: string): number;

  /**
   * Clear all subscriptions (useful for testing)
   */
  clear(): Promise<void>;

  /**
   * Get adapter statistics
   */
  getStats(): {
    connected: boolean;
    totalSubscriptions: number;
    totalTopics: number;
    topics: Array<{ topic: string; subscriptionCount: number }>;
  };
}

/**
 * Configuration for PubSub adapters
 */
export interface PubSubConfig {
  /** Adapter type: 'memory' or 'redis' */
  adapter: 'memory' | 'redis';

  /** Redis configuration (when adapter = 'redis') */
  redis?: {
    url: string;
    prefix?: string;
    retryStrategy?: (times: number) => number | void;
  };

  /** Memory adapter configuration */
  memory?: {
    maxMessages?: number;
  };
}

/**
 * Topic pattern matching
 */
export interface TopicMatcher {
  /**
   * Check if topic matches pattern
   * Supports wildcards:
   * - * matches single segment (messages.*)
   * - ** matches multiple segments (messages.**)
   */
  matches(topic: string, pattern: string): boolean;
}

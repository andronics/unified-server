/**
 * Redis cache client
 * Layer 3: Integration
 */

import Redis from 'ioredis';
import { config } from '@infrastructure/config/config-loader';
import { logger } from '@infrastructure/logging/logger';
import { metricsService } from '@infrastructure/metrics/metrics';
import { ApiError } from '@shared/errors/api-error';

/**
 * Redis cache client
 */
export class RedisClient {
  private client: Redis;
  private isConnected: boolean = false;

  constructor() {
    this.client = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        logger.warn({ times, delay }, 'Redis connection retry');
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    // Connection events
    this.client.on('connect', () => {
      logger.info('Redis connecting...');
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      logger.info(
        {
          host: config.redis.host,
          port: config.redis.port,
          db: config.redis.db,
        },
        '✓ Redis connected'
      );
    });

    this.client.on('error', (error) => {
      this.isConnected = false;
      logger.error({ error }, 'Redis error');
    });

    this.client.on('close', () => {
      this.isConnected = false;
      logger.warn('Redis connection closed');
    });
  }

  /**
   * Get value from cache
   */
  async get<T = string>(key: string): Promise<T | null> {
    const start = Date.now();

    try {
      const value = await this.client.get(key);
      const duration = (Date.now() - start) / 1000;

      metricsService.cacheOperationDuration.observe({ operation: 'get' }, duration);

      if (value === null) {
        metricsService.cacheMisses.inc();
        logger.debug({ key, duration }, 'Cache miss');
        return null;
      }

      metricsService.cacheHits.inc();
      logger.debug({ key, duration }, 'Cache hit');

      // Try to parse as JSON, otherwise return as string
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as unknown as T;
      }
    } catch (error) {
      const duration = (Date.now() - start) / 1000;
      metricsService.cacheOperationDuration.observe({ operation: 'get' }, duration);

      logger.error({ error, key }, 'Failed to get from cache');
      throw ApiError.cacheError('Cache get operation failed', { key });
    }
  }

  /**
   * Set value in cache
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    const start = Date.now();

    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      const cacheTtl = ttl || config.cache.ttl;

      await this.client.setex(key, cacheTtl, serialized);

      const duration = (Date.now() - start) / 1000;
      metricsService.cacheOperationDuration.observe({ operation: 'set' }, duration);

      logger.debug({ key, ttl: cacheTtl, duration }, 'Cache set');
    } catch (error) {
      const duration = (Date.now() - start) / 1000;
      metricsService.cacheOperationDuration.observe({ operation: 'set' }, duration);

      logger.error({ error, key }, 'Failed to set cache');
      throw ApiError.cacheError('Cache set operation failed', { key });
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    const start = Date.now();

    try {
      await this.client.del(key);

      const duration = (Date.now() - start) / 1000;
      metricsService.cacheOperationDuration.observe({ operation: 'delete' }, duration);

      logger.debug({ key, duration }, 'Cache delete');
    } catch (error) {
      const duration = (Date.now() - start) / 1000;
      metricsService.cacheOperationDuration.observe({ operation: 'delete' }, duration);

      logger.error({ error, key }, 'Failed to delete from cache');
      throw ApiError.cacheError('Cache delete operation failed', { key });
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    const start = Date.now();

    try {
      const keys = await this.client.keys(pattern);

      if (keys.length === 0) {
        return 0;
      }

      await this.client.del(...keys);

      const duration = (Date.now() - start) / 1000;
      metricsService.cacheOperationDuration.observe({ operation: 'deletePattern' }, duration);

      logger.debug({ pattern, count: keys.length, duration }, 'Cache pattern delete');

      return keys.length;
    } catch (error) {
      const duration = (Date.now() - start) / 1000;
      metricsService.cacheOperationDuration.observe({ operation: 'deletePattern' }, duration);

      logger.error({ error, pattern }, 'Failed to delete pattern from cache');
      throw ApiError.cacheError('Cache pattern delete operation failed', { pattern });
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error({ error, key }, 'Failed to check cache key existence');
      throw ApiError.cacheError('Cache exists operation failed', { key });
    }
  }

  /**
   * Get remaining TTL for a key
   */
  async getTTL(key: string): Promise<number> {
    try {
      const ttl = await this.client.ttl(key);
      return ttl;
    } catch (error) {
      logger.error({ error, key }, 'Failed to get cache TTL');
      throw ApiError.cacheError('Cache TTL operation failed', { key });
    }
  }

  /**
   * Flush all cache data
   */
  async flush(): Promise<void> {
    try {
      await this.client.flushdb();
      logger.warn('Cache flushed');
    } catch (error) {
      logger.error({ error }, 'Failed to flush cache');
      throw ApiError.cacheError('Cache flush operation failed');
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error({ error }, 'Redis health check failed');
      return false;
    }
  }

  /**
   * Check if Redis is connected
   */
  isHealthy(): boolean {
    return this.isConnected;
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      logger.info('Redis disconnected');
    } catch (error) {
      logger.error({ error }, 'Error disconnecting from Redis');
      throw error;
    }
  }
}

// Export singleton instance
export const redisClient = new RedisClient();

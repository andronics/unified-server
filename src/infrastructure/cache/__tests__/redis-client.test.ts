/**
 * Redis Client Tests
 * Tests Redis cache operations with mocked ioredis
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiError } from '@shared/errors/api-error';

// Mock dependencies
vi.mock('ioredis');
vi.mock('@infrastructure/config/config-loader', () => ({
  config: {
    redis: {
      host: 'localhost',
      port: 6379,
      password: undefined,
      db: 0,
    },
    cache: {
      ttl: 3600,
    },
  },
}));
vi.mock('@infrastructure/logging/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));
vi.mock('@infrastructure/metrics/metrics', () => ({
  metricsService: {
    cacheHits: { inc: vi.fn() },
    cacheMisses: { inc: vi.fn() },
    cacheOperationDuration: { observe: vi.fn() },
  },
}));

import Redis from 'ioredis';
import { RedisClient } from '../redis-client';

describe('RedisClient', () => {
  let mockRedis: any;
  let redisClient: RedisClient;

  beforeEach(() => {
    // Create mock Redis instance
    mockRedis = {
      get: vi.fn(),
      set: vi.fn(),
      setex: vi.fn(),
      del: vi.fn(),
      keys: vi.fn(),
      exists: vi.fn(),
      ttl: vi.fn(),
      flushdb: vi.fn(),
      ping: vi.fn(),
      quit: vi.fn(),
      on: vi.fn(),
    };

    // Mock Redis constructor
    vi.mocked(Redis).mockImplementation(() => mockRedis as any);

    // Create new client instance
    redisClient = new RedisClient();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should create Redis client with correct configuration', () => {
      expect(Redis).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'localhost',
          port: 6379,
          password: undefined,
          db: 0,
          maxRetriesPerRequest: 3,
        })
      );
    });

    it('should register connection event handlers', () => {
      expect(mockRedis.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith('ready', expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should have retry strategy', () => {
      const call = vi.mocked(Redis).mock.calls[0][0];
      const retryStrategy = call?.retryStrategy;

      expect(retryStrategy).toBeDefined();
      expect(retryStrategy!(1)).toBe(50);
      expect(retryStrategy!(10)).toBe(500);
      expect(retryStrategy!(50)).toBe(2000);
    });
  });

  describe('get()', () => {
    it('should get and parse JSON value from cache', async () => {
      const testData = { id: 1, name: 'test' };
      mockRedis.get.mockResolvedValue(JSON.stringify(testData));

      const result = await redisClient.get('test-key');

      expect(mockRedis.get).toHaveBeenCalledWith('test-key');
      expect(result).toEqual(testData);
    });

    it('should get string value from cache', async () => {
      mockRedis.get.mockResolvedValue('plain-string');

      const result = await redisClient.get<string>('test-key');

      expect(result).toBe('plain-string');
    });

    it('should return null for cache miss', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await redisClient.get('missing-key');

      expect(result).toBeNull();
    });

    it('should handle non-JSON strings', async () => {
      mockRedis.get.mockResolvedValue('not-json-string');

      const result = await redisClient.get('test-key');

      expect(result).toBe('not-json-string');
    });

    it('should throw ApiError on Redis error', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection lost'));

      await expect(redisClient.get('test-key')).rejects.toThrow(ApiError);
      await expect(redisClient.get('test-key')).rejects.toThrow('Cache get operation failed');
    });
  });

  describe('set()', () => {
    it('should set string value with default TTL', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await redisClient.set('test-key', 'test-value');

      expect(mockRedis.setex).toHaveBeenCalledWith('test-key', 3600, 'test-value');
    });

    it('should set object value as JSON', async () => {
      const testData = { id: 1, name: 'test' };
      mockRedis.setex.mockResolvedValue('OK');

      await redisClient.set('test-key', testData);

      expect(mockRedis.setex).toHaveBeenCalledWith('test-key', 3600, JSON.stringify(testData));
    });

    it('should set value with custom TTL', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await redisClient.set('test-key', 'test-value', 1800);

      expect(mockRedis.setex).toHaveBeenCalledWith('test-key', 1800, 'test-value');
    });

    it('should throw ApiError on Redis error', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Redis connection lost'));

      await expect(redisClient.set('test-key', 'value')).rejects.toThrow(ApiError);
      await expect(redisClient.set('test-key', 'value')).rejects.toThrow('Cache set operation failed');
    });
  });

  describe('delete()', () => {
    it('should delete key from cache', async () => {
      mockRedis.del.mockResolvedValue(1);

      await redisClient.delete('test-key');

      expect(mockRedis.del).toHaveBeenCalledWith('test-key');
    });

    it('should throw ApiError on Redis error', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis connection lost'));

      await expect(redisClient.delete('test-key')).rejects.toThrow(ApiError);
      await expect(redisClient.delete('test-key')).rejects.toThrow('Cache delete operation failed');
    });
  });

  describe('deletePattern()', () => {
    it('should delete multiple keys matching pattern', async () => {
      const matchingKeys = ['user:1', 'user:2', 'user:3'];
      mockRedis.keys.mockResolvedValue(matchingKeys);
      mockRedis.del.mockResolvedValue(3);

      const deleted = await redisClient.deletePattern('user:*');

      expect(mockRedis.keys).toHaveBeenCalledWith('user:*');
      expect(mockRedis.del).toHaveBeenCalledWith(...matchingKeys);
      expect(deleted).toBe(3);
    });

    it('should return 0 when no keys match pattern', async () => {
      mockRedis.keys.mockResolvedValue([]);

      const deleted = await redisClient.deletePattern('nonexistent:*');

      expect(mockRedis.keys).toHaveBeenCalledWith('nonexistent:*');
      expect(mockRedis.del).not.toHaveBeenCalled();
      expect(deleted).toBe(0);
    });

    it('should throw ApiError on Redis error', async () => {
      mockRedis.keys.mockRejectedValue(new Error('Redis connection lost'));

      await expect(redisClient.deletePattern('test:*')).rejects.toThrow(ApiError);
      await expect(redisClient.deletePattern('test:*')).rejects.toThrow(
        'Cache pattern delete operation failed'
      );
    });
  });

  describe('exists()', () => {
    it('should return true if key exists', async () => {
      mockRedis.exists.mockResolvedValue(1);

      const exists = await redisClient.exists('test-key');

      expect(mockRedis.exists).toHaveBeenCalledWith('test-key');
      expect(exists).toBe(true);
    });

    it('should return false if key does not exist', async () => {
      mockRedis.exists.mockResolvedValue(0);

      const exists = await redisClient.exists('missing-key');

      expect(exists).toBe(false);
    });

    it('should throw ApiError on Redis error', async () => {
      mockRedis.exists.mockRejectedValue(new Error('Redis connection lost'));

      await expect(redisClient.exists('test-key')).rejects.toThrow(ApiError);
      await expect(redisClient.exists('test-key')).rejects.toThrow('Cache exists operation failed');
    });
  });

  describe('getTTL()', () => {
    it('should return TTL for key', async () => {
      mockRedis.ttl.mockResolvedValue(1800);

      const ttl = await redisClient.getTTL('test-key');

      expect(mockRedis.ttl).toHaveBeenCalledWith('test-key');
      expect(ttl).toBe(1800);
    });

    it('should return -1 for key without expiry', async () => {
      mockRedis.ttl.mockResolvedValue(-1);

      const ttl = await redisClient.getTTL('persistent-key');

      expect(ttl).toBe(-1);
    });

    it('should return -2 for nonexistent key', async () => {
      mockRedis.ttl.mockResolvedValue(-2);

      const ttl = await redisClient.getTTL('missing-key');

      expect(ttl).toBe(-2);
    });

    it('should throw ApiError on Redis error', async () => {
      mockRedis.ttl.mockRejectedValue(new Error('Redis connection lost'));

      await expect(redisClient.getTTL('test-key')).rejects.toThrow(ApiError);
      await expect(redisClient.getTTL('test-key')).rejects.toThrow('Cache TTL operation failed');
    });
  });

  describe('flush()', () => {
    it('should flush all cache data', async () => {
      mockRedis.flushdb.mockResolvedValue('OK');

      await redisClient.flush();

      expect(mockRedis.flushdb).toHaveBeenCalled();
    });

    it('should throw ApiError on Redis error', async () => {
      mockRedis.flushdb.mockRejectedValue(new Error('Redis connection lost'));

      await expect(redisClient.flush()).rejects.toThrow(ApiError);
      await expect(redisClient.flush()).rejects.toThrow('Cache flush operation failed');
    });
  });

  describe('healthCheck()', () => {
    it('should return true if Redis responds with PONG', async () => {
      mockRedis.ping.mockResolvedValue('PONG');

      const healthy = await redisClient.healthCheck();

      expect(mockRedis.ping).toHaveBeenCalled();
      expect(healthy).toBe(true);
    });

    it('should return false if Redis ping fails', async () => {
      mockRedis.ping.mockRejectedValue(new Error('Connection refused'));

      const healthy = await redisClient.healthCheck();

      expect(healthy).toBe(false);
    });
  });

  describe('isHealthy()', () => {
    it('should return connection status', () => {
      // Initially not connected
      expect(redisClient.isHealthy()).toBe(false);

      // Simulate ready event
      const readyHandler = mockRedis.on.mock.calls.find((call) => call[0] === 'ready')?.[1];
      readyHandler?.();

      expect(redisClient.isHealthy()).toBe(true);

      // Simulate error event
      const errorHandler = mockRedis.on.mock.calls.find((call) => call[0] === 'error')?.[1];
      errorHandler?.(new Error('Connection lost'));

      expect(redisClient.isHealthy()).toBe(false);
    });
  });

  describe('disconnect()', () => {
    it('should disconnect from Redis gracefully', async () => {
      mockRedis.quit.mockResolvedValue('OK');

      await redisClient.disconnect();

      expect(mockRedis.quit).toHaveBeenCalled();
    });

    it('should propagate Redis error on disconnect failure', async () => {
      const error = new Error('Quit failed');
      mockRedis.quit.mockRejectedValue(error);

      await expect(redisClient.disconnect()).rejects.toThrow(error);
    });
  });

  describe('Connection Events', () => {
    it('should handle connect event', () => {
      const connectHandler = mockRedis.on.mock.calls.find((call) => call[0] === 'connect')?.[1];

      expect(() => connectHandler?.()).not.toThrow();
    });

    it('should handle ready event', () => {
      const readyHandler = mockRedis.on.mock.calls.find((call) => call[0] === 'ready')?.[1];

      readyHandler?.();

      expect(redisClient.isHealthy()).toBe(true);
    });

    it('should handle error event', () => {
      const errorHandler = mockRedis.on.mock.calls.find((call) => call[0] === 'error')?.[1];

      errorHandler?.(new Error('Test error'));

      expect(redisClient.isHealthy()).toBe(false);
    });

    it('should handle close event', () => {
      const closeHandler = mockRedis.on.mock.calls.find((call) => call[0] === 'close')?.[1];

      // Set to connected first
      const readyHandler = mockRedis.on.mock.calls.find((call) => call[0] === 'ready')?.[1];
      readyHandler?.();
      expect(redisClient.isHealthy()).toBe(true);

      // Then close
      closeHandler?.();

      expect(redisClient.isHealthy()).toBe(false);
    });
  });

  describe('Performance and Metrics', () => {
    it('should track cache hits', async () => {
      const { metricsService } = await import('@infrastructure/metrics/metrics');
      mockRedis.get.mockResolvedValue('"cached-value"');

      await redisClient.get('test-key');

      expect(metricsService.cacheHits.inc).toHaveBeenCalled();
    });

    it('should track cache misses', async () => {
      const { metricsService } = await import('@infrastructure/metrics/metrics');
      mockRedis.get.mockResolvedValue(null);

      await redisClient.get('missing-key');

      expect(metricsService.cacheMisses.inc).toHaveBeenCalled();
    });

    it('should track operation duration', async () => {
      const { metricsService } = await import('@infrastructure/metrics/metrics');
      mockRedis.get.mockResolvedValue('"value"');

      await redisClient.get('test-key');

      expect(metricsService.cacheOperationDuration.observe).toHaveBeenCalledWith(
        { operation: 'get' },
        expect.any(Number)
      );
    });
  });
});

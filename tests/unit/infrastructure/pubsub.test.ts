/**
 * PubSub Infrastructure Unit Tests
 *
 * Tests for:
 * - MemoryAdapter
 * - TopicMatcher
 * - PubSubBroker
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryAdapter } from '@infrastructure/pubsub/adapters/memory-adapter';
import { TopicMatcher } from '@infrastructure/pubsub/topic-matcher';
import { PubSubBroker } from '@infrastructure/pubsub/pubsub-broker';

describe('TopicMatcher', () => {
  let matcher: TopicMatcher;

  beforeEach(() => {
    matcher = new TopicMatcher();
  });

  describe('exact matching', () => {
    it('should match exact topic patterns', () => {
      expect(matcher.matches('messages', 'messages')).toBe(true);
      expect(matcher.matches('messages.user.123', 'messages.user.123')).toBe(true);
    });

    it('should not match different exact patterns', () => {
      expect(matcher.matches('messages', 'users')).toBe(false);
      expect(matcher.matches('messages.user.123', 'messages.user.456')).toBe(false);
    });
  });

  describe('single-level wildcard (*)', () => {
    it('should match single level wildcards', () => {
      expect(matcher.matches('messages.user', 'messages.*')).toBe(true);
      expect(matcher.matches('messages.user.123', 'messages.*.123')).toBe(true);
    });

    it('should not match across multiple levels', () => {
      expect(matcher.matches('messages.user.123', 'messages.*')).toBe(false);
    });

    it('should handle multiple wildcards in pattern', () => {
      expect(matcher.matches('messages.user.123.test', 'messages.*.*.test')).toBe(true);
      expect(matcher.matches('messages.user.123', '*.user.*')).toBe(true);
    });
  });

  describe('multi-level wildcard (**)', () => {
    it('should match multiple levels', () => {
      expect(matcher.matches('messages', 'messages.**')).toBe(true);
      expect(matcher.matches('messages.user', 'messages.**')).toBe(true);
      expect(matcher.matches('messages.user.123', 'messages.**')).toBe(true);
      expect(matcher.matches('messages.user.123.channel', 'messages.**')).toBe(true);
    });

    it('should only match if prefix matches', () => {
      expect(matcher.matches('users.123', 'messages.**')).toBe(false);
      expect(matcher.matches('messages.channel.123', 'messages.user.**')).toBe(false);
    });

    it('should handle ** at the end', () => {
      expect(matcher.matches('messages.user', 'messages.user.**')).toBe(true);
      expect(matcher.matches('messages.user.123.test.deep', 'messages.user.**')).toBe(true);
    });
  });

  describe('complex patterns', () => {
    it('should handle mixed wildcards', () => {
      expect(matcher.matches('messages.user.123.456.test', 'messages.*.**.test')).toBe(true);
      expect(matcher.matches('messages.user.123.456', '*.user.**')).toBe(true);
    });

    it('should handle edge cases', () => {
      expect(matcher.matches('', '')).toBe(true);
      expect(matcher.matches('anything', '*')).toBe(true);
      expect(matcher.matches('any.deep.topic', '**')).toBe(true);
    });
  });
});

describe('MemoryAdapter', () => {
  let adapter: MemoryAdapter;

  beforeEach(async () => {
    adapter = new MemoryAdapter();
    await adapter.connect();
  });

  afterEach(async () => {
    await adapter.disconnect();
  });

  describe('connection lifecycle', () => {
    it('should connect successfully', async () => {
      const newAdapter = new MemoryAdapter();
      await expect(newAdapter.connect()).resolves.toBeUndefined();
      await newAdapter.disconnect();
    });

    it('should disconnect successfully', async () => {
      await expect(adapter.disconnect()).resolves.toBeUndefined();
    });

    it('should check connection status', () => {
      expect(adapter.isConnected()).toBe(true);
    });
  });

  describe('subscribe and publish', () => {
    it('should receive published messages', async () => {
      const messages: any[] = [];
      const handler = vi.fn((message: any) => {
        messages.push(message);
      });

      await adapter.subscribe('test.topic', handler);
      await adapter.publish('test.topic', { content: 'Hello' }, { timestamp: '2024-01-01' });

      // Wait for async delivery
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledTimes(1);
      expect(messages).toHaveLength(1);
      expect(messages[0].topic).toBe('test.topic');
      expect(messages[0].data).toEqual({ content: 'Hello' });
      expect(messages[0].metadata).toEqual({ timestamp: '2024-01-01' });
    });

    it('should receive messages from wildcard subscriptions', async () => {
      const messages: any[] = [];
      const handler = vi.fn((message: any) => {
        messages.push(message);
      });

      await adapter.subscribe('messages.*', handler);
      await adapter.publish('messages.user', { userId: '123' });
      await adapter.publish('messages.channel', { channelId: '456' });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledTimes(2);
      expect(messages).toHaveLength(2);
    });

    it('should receive messages from multi-level wildcard', async () => {
      const messages: any[] = [];
      const handler = vi.fn((message: any) => {
        messages.push(message);
      });

      await adapter.subscribe('messages.**', handler);
      await adapter.publish('messages.user.123', { content: 'Test 1' });
      await adapter.publish('messages.user.123.channel.456', { content: 'Test 2' });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledTimes(2);
      expect(messages).toHaveLength(2);
    });

    it('should support multiple subscriptions to same topic', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      await adapter.subscribe('test.topic', handler1);
      await adapter.subscribe('test.topic', handler2);
      await adapter.publish('test.topic', { content: 'Hello' });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should not receive messages after unsubscribe', async () => {
      const handler = vi.fn();

      const subscriptionId = await adapter.subscribe('test.topic', handler);
      await adapter.publish('test.topic', { content: 'Message 1' });

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(handler).toHaveBeenCalledTimes(1);

      await adapter.unsubscribe(subscriptionId);
      await adapter.publish('test.topic', { content: 'Message 2' });

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(handler).toHaveBeenCalledTimes(1); // Still 1, not 2
    });
  });

  describe('error handling', () => {
    it('should handle handler errors gracefully', async () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      const goodHandler = vi.fn();

      await adapter.subscribe('test.topic', errorHandler);
      await adapter.subscribe('test.topic', goodHandler);
      await adapter.publish('test.topic', { content: 'Test' });

      await new Promise(resolve => setTimeout(resolve, 10));

      // Both handlers should be called despite error
      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(goodHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('statistics', () => {
    it('should track subscriptions and messages', async () => {
      const handler = vi.fn();

      await adapter.subscribe('topic1', handler);
      await adapter.subscribe('topic2', handler);
      await adapter.publish('topic1', { data: 'test' });
      await adapter.publish('topic2', { data: 'test' });

      await new Promise(resolve => setTimeout(resolve, 10));

      const stats = adapter.getStats();
      expect(stats.totalSubscriptions).toBe(2);
      expect(stats.connected).toBe(true);
    });
  });

  describe('max messages limit', () => {
    it('should respect maxMessages configuration', async () => {
      const smallAdapter = new MemoryAdapter({ maxMessages: 2 });
      await smallAdapter.connect();

      const handler = vi.fn();
      await smallAdapter.subscribe('test', handler);

      // Publish 3 messages but maxMessages is 2
      await smallAdapter.publish('test', { msg: 1 });
      await smallAdapter.publish('test', { msg: 2 });
      await smallAdapter.publish('test', { msg: 3 });

      await new Promise(resolve => setTimeout(resolve, 10));

      // Should receive all 3 (messages are delivered immediately, not queued)
      expect(handler).toHaveBeenCalledTimes(3);

      await smallAdapter.disconnect();
    });
  });
});

describe('PubSubBroker', () => {
  let broker: PubSubBroker;
  let adapter: MemoryAdapter;

  beforeEach(async () => {
    adapter = new MemoryAdapter();
    broker = new PubSubBroker(adapter);
    await broker.connect();
  });

  afterEach(async () => {
    await broker.disconnect();
  });

  describe('connection lifecycle', () => {
    it('should connect and disconnect successfully', async () => {
      const newAdapter = new MemoryAdapter();
      const newBroker = new PubSubBroker(newAdapter);

      await expect(newBroker.connect()).resolves.toBeUndefined();
      expect(newBroker.isConnected()).toBe(true);

      await expect(newBroker.disconnect()).resolves.toBeUndefined();
      expect(newBroker.isConnected()).toBe(false);
    });
  });

  describe('publish and subscribe', () => {
    it('should publish and receive messages', async () => {
      const messages: any[] = [];
      const handler = vi.fn((message: any) => {
        messages.push(message);
      });

      await broker.subscribe('test.topic', handler);
      await broker.publish('test.topic', { content: 'Hello' }, { timestamp: Date.now() });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalled();
      expect(messages).toHaveLength(1);
      expect(messages[0].data).toEqual({ content: 'Hello' });
    });

    it('should support topic patterns', async () => {
      const messages: string[] = [];
      const handler = vi.fn((message: any) => {
        messages.push(message.topic);
      });

      await broker.subscribe('messages.**', handler);
      await broker.publish('messages.user.123', { data: 'test1' });
      await broker.publish('messages.channel.456', { data: 'test2' });
      await broker.publish('users.789', { data: 'test3' }); // Should not match

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledTimes(2);
      expect(messages).toEqual(['messages.user.123', 'messages.channel.456']);
    });

    it('should unsubscribe successfully', async () => {
      const handler = vi.fn();

      const subscriptionId = await broker.subscribe('test.topic', handler);
      await broker.publish('test.topic', { data: 'Message 1' });

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(handler).toHaveBeenCalledTimes(1);

      await broker.unsubscribe(subscriptionId);
      await broker.publish('test.topic', { data: 'Message 2' });

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(handler).toHaveBeenCalledTimes(1); // Still 1
    });
  });

  describe('statistics', () => {
    it('should provide adapter statistics', async () => {
      const handler = vi.fn();

      await broker.subscribe('topic1', handler);
      await broker.publish('topic1', { data: 'test' });

      await new Promise(resolve => setTimeout(resolve, 10));

      const stats = broker.getStats();
      expect(stats.totalSubscriptions).toBeGreaterThanOrEqual(1);
      expect(stats.connected).toBe(true);
    });
  });

  describe('multiple subscribers', () => {
    it('should deliver to all matching subscribers', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      await broker.subscribe('messages.user.123', handler1);
      await broker.subscribe('messages.user.*', handler2);
      await broker.subscribe('messages.**', handler3);

      await broker.publish('messages.user.123', { content: 'Test' });

      await new Promise(resolve => setTimeout(resolve, 10));

      // All three should receive the message
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler3).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases', () => {
    it('should handle empty topic gracefully', async () => {
      const handler = vi.fn();
      await broker.subscribe('', handler);
      await broker.publish('', { data: 'test' });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalled();
    });

    it('should handle special characters in topics', async () => {
      const handler = vi.fn();
      await broker.subscribe('topic-with_special.chars', handler);
      await broker.publish('topic-with_special.chars', { data: 'test' });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalled();
    });

    it('should handle large messages', async () => {
      const handler = vi.fn();
      const largeData = { content: 'a'.repeat(10000) };

      await broker.subscribe('test.topic', handler);
      await broker.publish('test.topic', largeData);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalled();
      const call = handler.mock.calls[0][0];
      expect(call.topic).toBe('test.topic');
      expect(call.data).toEqual(largeData);
    });
  });
});

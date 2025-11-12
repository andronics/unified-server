/**
 * Unit tests for EventBus
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '@infrastructure/events/event-bus';
import type { UserCreatedEvent, MessageSentEvent } from '@shared/types/event-types';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  describe('on (subscribe)', () => {
    it('should subscribe to events', () => {
      const handler = vi.fn();
      const subscriptionId = eventBus.on('user.created', handler);

      expect(subscriptionId).toBeDefined();
      expect(typeof subscriptionId).toBe('string');
    });

    it('should return unique subscription IDs', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const id1 = eventBus.on('user.created', handler1);
      const id2 = eventBus.on('user.created', handler2);

      expect(id1).not.toBe(id2);
    });

    it('should allow multiple handlers for same event type', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.on('user.created', handler1);
      eventBus.on('user.created', handler2);

      const event: UserCreatedEvent = {
        eventId: '123',
        eventType: 'user.created',
        timestamp: new Date(),
        data: {
          user: {
            id: '1',
            email: 'test@example.com',
            name: 'Test',
            password: 'hashed',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      };

      eventBus.emit(event);

      // Wait for async emission
      return new Promise((resolve) => {
        setTimeout(() => {
          expect(handler1).toHaveBeenCalledOnce();
          expect(handler2).toHaveBeenCalledOnce();
          resolve(undefined);
        }, 50);
      });
    });
  });

  describe('emit', () => {
    it('should call handler when event emitted', async () => {
      const handler = vi.fn();
      eventBus.on('user.created', handler);

      const event: UserCreatedEvent = {
        eventId: '123',
        eventType: 'user.created',
        timestamp: new Date(),
        data: {
          user: {
            id: '1',
            email: 'test@example.com',
            name: 'Test',
            password: 'hashed',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      };

      await eventBus.emit(event);

      expect(handler).toHaveBeenCalledWith(event);
      expect(handler).toHaveBeenCalledOnce();
    });

    it('should not call handlers for different event types', async () => {
      const userHandler = vi.fn();
      const messageHandler = vi.fn();

      eventBus.on('user.created', userHandler);
      eventBus.on('message.sent', messageHandler);

      const event: UserCreatedEvent = {
        eventId: '123',
        eventType: 'user.created',
        timestamp: new Date(),
        data: {
          user: {
            id: '1',
            email: 'test@example.com',
            name: 'Test',
            password: 'hashed',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      };

      await eventBus.emit(event);

      expect(userHandler).toHaveBeenCalledOnce();
      expect(messageHandler).not.toHaveBeenCalled();
    });

    it('should handle no subscriptions gracefully', async () => {
      const event: UserCreatedEvent = {
        eventId: '123',
        eventType: 'user.created',
        timestamp: new Date(),
        data: {
          user: {
            id: '1',
            email: 'test@example.com',
            name: 'Test',
            password: 'hashed',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      };

      await expect(eventBus.emit(event)).resolves.not.toThrow();
    });

    it('should handle handler errors gracefully', async () => {
      const errorHandler = vi.fn().mockRejectedValue(new Error('Handler failed'));
      const successHandler = vi.fn();

      eventBus.on('user.created', errorHandler);
      eventBus.on('user.created', successHandler);

      const event: UserCreatedEvent = {
        eventId: '123',
        eventType: 'user.created',
        timestamp: new Date(),
        data: {
          user: {
            id: '1',
            email: 'test@example.com',
            name: 'Test',
            password: 'hashed',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      };

      await eventBus.emit(event);

      expect(errorHandler).toHaveBeenCalled();
      expect(successHandler).toHaveBeenCalled();
    });
  });

  describe('off (unsubscribe)', () => {
    it('should unsubscribe from events', async () => {
      const handler = vi.fn();
      const subscriptionId = eventBus.on('user.created', handler);

      eventBus.off(subscriptionId);

      const event: UserCreatedEvent = {
        eventId: '123',
        eventType: 'user.created',
        timestamp: new Date(),
        data: {
          user: {
            id: '1',
            email: 'test@example.com',
            name: 'Test',
            password: 'hashed',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      };

      await eventBus.emit(event);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should only unsubscribe specific handler', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const id1 = eventBus.on('user.created', handler1);
      eventBus.on('user.created', handler2);

      eventBus.off(id1);

      const event: UserCreatedEvent = {
        eventId: '123',
        eventType: 'user.created',
        timestamp: new Date(),
        data: {
          user: {
            id: '1',
            email: 'test@example.com',
            name: 'Test',
            password: 'hashed',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      };

      await eventBus.emit(event);

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledOnce();
    });

    it('should handle invalid subscription ID gracefully', () => {
      expect(() => eventBus.off('invalid-id')).not.toThrow();
    });
  });

  describe('getSubscriptions', () => {
    it('should return all subscriptions', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.on('user.created', handler1);
      eventBus.on('message.sent', handler2);

      const subscriptions = eventBus.getSubscriptions();

      expect(subscriptions.length).toBeGreaterThanOrEqual(2);
    });

    it('should include subscription details', () => {
      const handler = vi.fn();
      const subscriptionId = eventBus.on('user.created', handler);

      const subscriptions = eventBus.getSubscriptions();
      const subscription = subscriptions.find((s) => s.id === subscriptionId);

      expect(subscription).toBeDefined();
      expect(subscription?.eventType).toBe('user.created');
      expect(subscription?.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('clear', () => {
    it('should remove all subscriptions', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.on('user.created', handler1);
      eventBus.on('message.sent', handler2);

      eventBus.clear();

      const userEvent: UserCreatedEvent = {
        eventId: '123',
        eventType: 'user.created',
        timestamp: new Date(),
        data: {
          user: {
            id: '1',
            email: 'test@example.com',
            name: 'Test',
            password: 'hashed',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      };

      const messageEvent: MessageSentEvent = {
        eventId: '456',
        eventType: 'message.sent',
        timestamp: new Date(),
        data: {
          message: {
            id: '1',
            userId: '1',
            content: 'Test',
            createdAt: new Date(),
          },
        },
      };

      await eventBus.emit(userEvent);
      await eventBus.emit(messageEvent);

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
  });
});

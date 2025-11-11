/**
 * Event system type definitions
 * Layer 1: Foundation
 */

import { User, Message } from './common-types';

/**
 * Base event interface
 */
export interface BaseEvent {
  eventId: string;
  eventType: string;
  timestamp: Date;
  correlationId?: string;
}

/**
 * User-related events
 */
export interface UserCreatedEvent extends BaseEvent {
  eventType: 'user.created';
  data: {
    user: User;
  };
}

export interface UserUpdatedEvent extends BaseEvent {
  eventType: 'user.updated';
  data: {
    userId: string;
    changes: Partial<User>;
  };
}

export interface UserDeletedEvent extends BaseEvent {
  eventType: 'user.deleted';
  data: {
    userId: string;
  };
}

/**
 * Message-related events
 */
export interface MessageSentEvent extends BaseEvent {
  eventType: 'message.sent';
  data: {
    message: Message;
  };
}

export interface MessageReceivedEvent extends BaseEvent {
  eventType: 'message.received';
  data: {
    message: Message;
    recipientId: string;
  };
}

/**
 * Union type of all events
 */
export type AppEvent =
  | UserCreatedEvent
  | UserUpdatedEvent
  | UserDeletedEvent
  | MessageSentEvent
  | MessageReceivedEvent;

/**
 * Event handler function type
 */
export type EventHandler<T extends AppEvent = AppEvent> = (event: T) => void | Promise<void>;

/**
 * Event subscription
 */
export interface EventSubscription {
  id: string;
  eventType: string;
  handler: EventHandler;
  createdAt: Date;
}

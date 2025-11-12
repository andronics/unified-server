/**
 * GraphQL Subscription Resolvers
 * Layer 4: Application
 *
 * Implements all Subscription operations
 * Connects to PubSub broker for real-time updates
 */

import { GraphQLContext } from '@shared/types/graphql-types';
import { pubSubBroker } from '@infrastructure/pubsub/pubsub-broker';
import { ApiError } from '@shared/errors/api-error';
import { logger } from '@infrastructure/logging/logger';
import { User, Message } from '@shared/types/common-types';

/**
 * Create an async iterator from PubSub subscription
 */
function createPubSubAsyncIterator<T>(
  topic: string,
  extractPayload: (data: any) => T,
  subscriptionName: string
): AsyncGenerator<T, void, unknown> {
  const messageQueue: Array<T> = [];
  const resolveQueue: Array<(value: IteratorResult<T>) => void> = [];
  let subscriptionId: string | null = null;
  let isComplete = false;

  // Subscribe to PubSub
  const setupSubscription = async () => {
    subscriptionId = await pubSubBroker.subscribe(topic, async (message) => {
      try {
        const payload = extractPayload(message.data);

        logger.debug(
          { topic, subscriptionName, payload },
          'GraphQL subscription received message'
        );

        // If there's a waiting resolver, resolve it immediately
        if (resolveQueue.length > 0) {
          const resolve = resolveQueue.shift()!;
          resolve({ value: payload, done: false });
        } else {
          // Otherwise, queue the message
          messageQueue.push(payload);
        }
      } catch (error) {
        logger.error(
          { error, topic, subscriptionName },
          'Error processing subscription message'
        );
      }
    });

    logger.info(
      { topic, subscriptionId, subscriptionName },
      'GraphQL subscription established'
    );
  };

  // Start subscription immediately
  setupSubscription().catch((error) => {
    logger.error({ error, topic, subscriptionName }, 'Failed to setup subscription');
  });

  // Return async generator
  return (async function* () {
    try {
      while (!isComplete) {
        // If there are queued messages, yield the first one
        if (messageQueue.length > 0) {
          const message = messageQueue.shift()!;
          yield message;
        } else {
          // Otherwise, wait for the next message
          const message = await new Promise<T>((resolve) => {
            resolveQueue.push((result) => {
              if (!result.done) {
                resolve(result.value);
              }
            });
          });
          yield message;
        }
      }
    } finally {
      // Cleanup: unsubscribe when generator is done
      if (subscriptionId) {
        await pubSubBroker.unsubscribe(subscriptionId);
        logger.info(
          { subscriptionId, subscriptionName },
          'GraphQL subscription cleanup complete'
        );
      }
    }
  })();
}

/**
 * Subscription resolvers
 */
export const subscriptionResolvers = {
  /**
   * Subscribe to new user registrations
   * Emitted when: UserService.createUser() completes
   */
  userCreated: {
    subscribe: (_parent: any, _args: any, context: GraphQLContext) => {
      logger.info({ correlationId: context.correlationId }, 'GraphQL Subscription: userCreated');

      return createPubSubAsyncIterator<{ userCreated: User }>(
        'users',
        (data) => {
          // Extract user from event data
          const user = data.user || data;
          return { userCreated: user };
        },
        'userCreated'
      );
    },
  },

  /**
   * Subscribe to user profile updates
   * Optionally filter by specific userId
   * Emitted when: UserService.updateUser() completes
   */
  userUpdated: {
    subscribe: (_parent: any, args: { userId?: string }, context: GraphQLContext) => {
      logger.info(
        { userId: args.userId, correlationId: context.correlationId },
        'GraphQL Subscription: userUpdated'
      );

      const topic = args.userId ? `users.${args.userId}` : 'users';

      return createPubSubAsyncIterator<{ userUpdated: User }>(
        topic,
        (data) => {
          // Extract user from event data
          const user = data.user || data;
          return { userUpdated: user };
        },
        'userUpdated'
      );
    },
  },

  /**
   * Subscribe to new messages
   * Optionally filter by channelId
   * Emitted when: MessageService.sendMessage() completes
   */
  messageSent: {
    subscribe: (_parent: any, args: { channelId?: string }, context: GraphQLContext) => {
      logger.info(
        { channelId: args.channelId, correlationId: context.correlationId },
        'GraphQL Subscription: messageSent'
      );

      const topic = args.channelId ? `messages.channel.${args.channelId}` : 'messages';

      return createPubSubAsyncIterator<{ messageSent: Message }>(
        topic,
        (data) => {
          // Extract message from event data
          const message = data.message || data;
          return { messageSent: message };
        },
        'messageSent'
      );
    },
  },

  /**
   * Subscribe to direct messages sent to a specific user
   * Requires authentication - users can only subscribe to their own messages
   * Emitted when: MessageService.sendMessage() completes with recipientId
   */
  messageToUser: {
    subscribe: (_parent: any, args: { userId: string }, context: GraphQLContext) => {
      if (!context.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      // Users can only subscribe to their own messages
      if (context.user.id !== args.userId) {
        throw ApiError.forbidden('You can only subscribe to your own messages');
      }

      logger.info(
        { userId: args.userId, correlationId: context.correlationId },
        'GraphQL Subscription: messageToUser'
      );

      const topic = `messages.user.${args.userId}`;

      return createPubSubAsyncIterator<{ messageToUser: Message }>(
        topic,
        (data) => {
          // Extract message from event data
          const message = data.message || data;
          return { messageToUser: message };
        },
        'messageToUser'
      );
    },
  },
};

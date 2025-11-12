/**
 * GraphQL Field Resolvers
 * Layer 4: Application
 *
 * Implements field-level resolvers for nested data
 */

import { Message } from '@shared/types/common-types';
import { GraphQLContext } from '@shared/types/graphql-types';
import { userService } from '@domain/users/user.service';
import { logger } from '@infrastructure/logging/logger';

/**
 * Message field resolvers
 */
export const messageFieldResolvers = {
  /**
   * Resolve the user who sent the message
   */
  user: async (parent: Message, _args: any, context: GraphQLContext) => {
    logger.debug(
      { messageId: parent.id, userId: parent.userId, correlationId: context.correlationId },
      'GraphQL Field: Message.user'
    );

    try {
      const user = await userService.getUser(parent.userId);
      return user;
    } catch (error) {
      logger.error({ error, userId: parent.userId }, 'Failed to resolve message.user');
      throw error;
    }
  },

  /**
   * Resolve the recipient user (for direct messages)
   */
  recipient: async (parent: Message, _args: any, context: GraphQLContext) => {
    // Return null if no recipient (channel message)
    if (!parent.recipientId) {
      return null;
    }

    logger.debug(
      { messageId: parent.id, recipientId: parent.recipientId, correlationId: context.correlationId },
      'GraphQL Field: Message.recipient'
    );

    try {
      const recipient = await userService.getUser(parent.recipientId);
      return recipient;
    } catch (error) {
      logger.error({ error, recipientId: parent.recipientId }, 'Failed to resolve message.recipient');
      throw error;
    }
  },
};

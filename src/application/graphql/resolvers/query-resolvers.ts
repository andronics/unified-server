/**
 * GraphQL Query Resolvers
 * Layer 4: Application
 *
 * Implements all Query operations by delegating to existing services
 */

import { GraphQLContext } from '@foundation/types/graphql-types';
import { userService } from '@application/services/user-service';
import { messageService } from '@application/services/message-service';
import { ApiError } from '@foundation/errors/api-error';
import { logger } from '@infrastructure/logging/logger';
import { uuidSchema } from '../validators';

/**
 * Query resolvers
 */
export const queryResolvers = {
  /**
   * Get a user by ID
   */
  user: async (_parent: any, args: { id: string }, context: GraphQLContext) => {
    logger.debug({ userId: args.id, correlationId: context.correlationId }, 'GraphQL Query: user');

    try {
      // Validate input
      const validatedId = uuidSchema.parse(args.id);

      const user = await userService.getUser(validatedId);
      return user;
    } catch (error) {
      logger.error({ error, userId: args.id }, 'Failed to get user');
      throw error;
    }
  },

  /**
   * Get the currently authenticated user
   * Requires authentication
   */
  me: async (_parent: any, _args: any, context: GraphQLContext) => {
    logger.debug({ correlationId: context.correlationId }, 'GraphQL Query: me');

    if (!context.user) {
      throw ApiError.unauthorized('Authentication required');
    }

    try {
      // Return the user from context (already fetched during auth)
      return context.user;
    } catch (error) {
      logger.error({ error }, 'Failed to get current user');
      throw error;
    }
  },

  /**
   * Get a message by ID
   */
  message: async (_parent: any, args: { id: string }, context: GraphQLContext) => {
    logger.debug({ messageId: args.id, correlationId: context.correlationId }, 'GraphQL Query: message');

    try {
      const message = await messageService.getMessage(args.id);
      return message;
    } catch (error) {
      logger.error({ error, messageId: args.id }, 'Failed to get message');
      throw error;
    }
  },

  /**
   * Get all messages with pagination
   */
  messages: async (_parent: any, args: { page?: number; limit?: number }, context: GraphQLContext) => {
    const page = args.page || 1;
    const limit = args.limit || 20;

    logger.debug(
      { page, limit, correlationId: context.correlationId },
      'GraphQL Query: messages'
    );

    try {
      const result = await messageService.getMessages({ page, limit });

      // Transform to GraphQL Connection format
      return {
        edges: result.data.map((message) => ({
          node: message,
          cursor: Buffer.from(`message:${message.id}`).toString('base64'),
        })),
        pageInfo: {
          page: result.pagination.page,
          limit: result.pagination.limit,
          total: result.pagination.total,
          totalPages: result.pagination.totalPages,
          hasNextPage: result.pagination.hasNextPage,
          hasPreviousPage: result.pagination.hasPreviousPage,
        },
      };
    } catch (error) {
      logger.error({ error, page, limit }, 'Failed to get messages');
      throw error;
    }
  },

  /**
   * Get messages sent by a specific user
   */
  userMessages: async (
    _parent: any,
    args: { userId: string; page?: number; limit?: number },
    context: GraphQLContext
  ) => {
    const page = args.page || 1;
    const limit = args.limit || 20;

    logger.debug(
      { userId: args.userId, page, limit, correlationId: context.correlationId },
      'GraphQL Query: userMessages'
    );

    try {
      const result = await messageService.getUserMessages(args.userId, { page, limit });

      // Transform to GraphQL Connection format
      return {
        edges: result.data.map((message) => ({
          node: message,
          cursor: Buffer.from(`message:${message.id}`).toString('base64'),
        })),
        pageInfo: {
          page: result.pagination.page,
          limit: result.pagination.limit,
          total: result.pagination.total,
          totalPages: result.pagination.totalPages,
          hasNextPage: result.pagination.hasNextPage,
          hasPreviousPage: result.pagination.hasPreviousPage,
        },
      };
    } catch (error) {
      logger.error({ error, userId: args.userId, page, limit }, 'Failed to get user messages');
      throw error;
    }
  },

  /**
   * Get messages in a specific channel
   */
  channelMessages: async (
    _parent: any,
    args: { channelId: string; page?: number; limit?: number },
    context: GraphQLContext
  ) => {
    const page = args.page || 1;
    const limit = args.limit || 20;

    logger.debug(
      { channelId: args.channelId, page, limit, correlationId: context.correlationId },
      'GraphQL Query: channelMessages'
    );

    try {
      const result = await messageService.getChannelMessages(args.channelId, { page, limit });

      // Transform to GraphQL Connection format
      return {
        edges: result.data.map((message) => ({
          node: message,
          cursor: Buffer.from(`message:${message.id}`).toString('base64'),
        })),
        pageInfo: {
          page: result.pagination.page,
          limit: result.pagination.limit,
          total: result.pagination.total,
          totalPages: result.pagination.totalPages,
          hasNextPage: result.pagination.hasNextPage,
          hasPreviousPage: result.pagination.hasPreviousPage,
        },
      };
    } catch (error) {
      logger.error({ error, channelId: args.channelId, page, limit }, 'Failed to get channel messages');
      throw error;
    }
  },
};

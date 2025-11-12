/**
 * GraphQL Mutation Resolvers
 * Layer 4: Application
 *
 * Implements all Mutation operations by delegating to existing services
 */

import { GraphQLContext, RegisterInput, UpdateUserInput, SendMessageInput } from '@shared/types/graphql-types';
import { userService } from '@domain/users/user.service';
import { messageService } from '@domain/messages/message.service';
import { ApiError } from '@shared/errors/api-error';
import { logger } from '@infrastructure/logging/logger';
import {
  registerInputSchema,
  loginInputSchema,
  updateUserInputSchema,
  sendMessageInputSchema,
  uuidSchema,
} from '../validators';
import { ZodError } from 'zod';

/**
 * Mutation resolvers
 */
export const mutationResolvers = {
  /**
   * Register a new user account
   */
  register: async (_parent: any, args: { input: RegisterInput }, context: GraphQLContext) => {
    logger.info(
      { email: args.input.email, correlationId: context.correlationId },
      'GraphQL Mutation: register'
    );

    try {
      // Validate input
      const validatedInput = registerInputSchema.parse(args.input);

      // Create user
      await userService.createUser(validatedInput);

      // Authenticate to get token
      const authResponse = await userService.authenticate({
        email: validatedInput.email,
        password: validatedInput.password,
      });

      return authResponse;
    } catch (error) {
      if (error instanceof ZodError) {
        const firstError = error.errors[0];
        throw ApiError.validationError(
          firstError.message,
          error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))
        );
      }
      logger.error({ error, email: args.input.email }, 'Failed to register user');
      throw error;
    }
  },

  /**
   * Login with email and password
   */
  login: async (
    _parent: any,
    args: { email: string; password: string },
    context: GraphQLContext
  ) => {
    logger.info({ email: args.email, correlationId: context.correlationId }, 'GraphQL Mutation: login');

    try {
      // Validate input
      const validatedInput = loginInputSchema.parse(args);

      const authResponse = await userService.authenticate({
        email: validatedInput.email,
        password: validatedInput.password,
      });

      return authResponse;
    } catch (error) {
      logger.error({ error, email: args.email }, 'Failed to login');
      throw error;
    }
  },

  /**
   * Update user profile
   * Operates on the authenticated user (no ID parameter needed)
   * Requires authentication
   */
  updateUser: async (
    _parent: any,
    args: { input: UpdateUserInput },
    context: GraphQLContext
  ) => {
    if (!context.user) {
      throw ApiError.unauthorized('Authentication required');
    }

    logger.info(
      { userId: context.user.id, correlationId: context.correlationId },
      'GraphQL Mutation: updateUser'
    );

    try {
      // Validate input
      const validatedInput = updateUserInputSchema.parse(args.input);

      // Update the authenticated user's profile
      const updatedUser = await userService.updateUser(context.user.id, validatedInput);
      return updatedUser;
    } catch (error) {
      logger.error({ error, userId: context.user.id }, 'Failed to update user');
      throw error;
    }
  },

  /**
   * Delete user account
   * Deletes the authenticated user's account (no ID parameter needed)
   * Requires authentication
   */
  deleteUser: async (_parent: any, _args: any, context: GraphQLContext) => {
    if (!context.user) {
      throw ApiError.unauthorized('Authentication required');
    }

    logger.info(
      { userId: context.user.id, correlationId: context.correlationId },
      'GraphQL Mutation: deleteUser'
    );

    try {
      // Delete the authenticated user's account
      await userService.deleteUser(context.user.id);
      return true;
    } catch (error) {
      logger.error({ error, userId: context.user.id }, 'Failed to delete user');
      throw error;
    }
  },

  /**
   * Send a new message
   * Requires authentication
   */
  sendMessage: async (
    _parent: any,
    args: { input: SendMessageInput },
    context: GraphQLContext
  ) => {
    logger.info(
      { recipientId: args.input.recipientId, channelId: args.input.channelId, correlationId: context.correlationId },
      'GraphQL Mutation: sendMessage'
    );

    if (!context.user) {
      throw ApiError.unauthorized('Authentication required');
    }

    try {
      // Validate input
      const validatedInput = sendMessageInputSchema.parse(args.input);

      // Add authenticated user's ID to the message
      const message = await messageService.sendMessage({
        ...validatedInput,
        userId: context.user.id,
      });

      return message;
    } catch (error) {
      logger.error({ error, input: args.input }, 'Failed to send message');
      throw error;
    }
  },

  /**
   * Delete a message
   * Requires authentication - can only delete own messages
   */
  deleteMessage: async (_parent: any, args: { id: string }, context: GraphQLContext) => {
    logger.info(
      { messageId: args.id, correlationId: context.correlationId },
      'GraphQL Mutation: deleteMessage'
    );

    if (!context.user) {
      throw ApiError.unauthorized('Authentication required');
    }

    try {
      // Validate input
      const validatedId = uuidSchema.parse(args.id);

      await messageService.deleteMessage(validatedId, context.user.id);
      return true;
    } catch (error) {
      logger.error({ error, messageId: args.id }, 'Failed to delete message');
      throw error;
    }
  },
};

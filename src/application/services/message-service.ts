/**
 * Message service with business logic
 * Layer 4: Application
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Message,
  CreateMessageInput,
  PaginationOptions,
  PaginatedResponse,
} from '@foundation/types/common-types';
import { ApiError } from '@foundation/errors/api-error';
import type { MessageRepository } from '@integration/database/repositories/message-repository';
import type { UserRepository } from '@integration/database/repositories/user-repository';
import type { EventBus } from '@infrastructure/events/event-bus';
import { messageRepository } from '@integration/database/repositories/message-repository';
import { userRepository } from '@integration/database/repositories/user-repository';
import { eventBus } from '@infrastructure/events/event-bus';
import { logger } from '@infrastructure/logging/logger';
import { MessageSentEvent } from '@foundation/types/event-types';

/**
 * Message service
 */
export class MessageService {
  private messageRepository: MessageRepository;
  private userRepository: UserRepository;
  private eventBus: EventBus;

  constructor(
    deps?: {
      messageRepository?: MessageRepository;
      userRepository?: UserRepository;
      eventBus?: EventBus;
    }
  ) {
    this.messageRepository = deps?.messageRepository || messageRepository;
    this.userRepository = deps?.userRepository || userRepository;
    this.eventBus = deps?.eventBus || eventBus;
  }
  /**
   * Send a message
   */
  async sendMessage(input: CreateMessageInput): Promise<Message> {
    try {
      logger.info(
        {
          userId: input.userId,
          recipientId: input.recipientId,
          channelId: input.channelId,
        },
        'Sending message'
      );

      // Validate sender exists
      const senderExists = await this.userRepository.exists(input.userId);
      if (!senderExists) {
        throw ApiError.notFound('Sender user', input.userId);
      }

      // Validate recipient exists (if specified)
      if (input.recipientId) {
        const recipientExists = await this.userRepository.exists(input.recipientId);
        if (!recipientExists) {
          throw ApiError.notFound('Recipient user', input.recipientId);
        }
      }

      // Create message
      const message = await this.messageRepository.create(input);

      // Emit event (this is where WebSocket would pick it up in the future)
      const event: MessageSentEvent = {
        eventId: uuidv4(),
        eventType: 'message.sent',
        timestamp: new Date(),
        data: { message },
      };
      await this.eventBus.emit(event);

      logger.info({ messageId: message.id }, 'Message sent successfully');

      return message;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      logger.error({ error, input }, 'Failed to send message');
      throw ApiError.internalError('Message sending failed');
    }
  }

  /**
   * Get message by ID
   */
  async getMessage(id: string): Promise<Message> {
    try {
      const message = await this.messageRepository.findById(id);

      if (!message) {
        throw ApiError.notFound('Message', id);
      }

      return message;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      logger.error({ error, messageId: id }, 'Failed to get message');
      throw ApiError.internalError('Failed to get message');
    }
  }

  /**
   * Get all messages with pagination
   */
  async getMessages(options: PaginationOptions): Promise<PaginatedResponse<Message>> {
    try {
      return await this.messageRepository.findAll(options);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      logger.error({ error, options }, 'Failed to get messages');
      throw ApiError.internalError('Failed to get messages');
    }
  }

  /**
   * Get messages by user ID
   */
  async getUserMessages(
    userId: string,
    options: PaginationOptions
  ): Promise<PaginatedResponse<Message>> {
    try {
      // Validate user exists
      const userExists = await this.userRepository.exists(userId);
      if (!userExists) {
        throw ApiError.notFound('User', userId);
      }

      return await this.messageRepository.findByUserId(userId, options);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      logger.error({ error, userId, options }, 'Failed to get user messages');
      throw ApiError.internalError('Failed to get user messages');
    }
  }

  /**
   * Get messages by channel ID
   */
  async getChannelMessages(
    channelId: string,
    options: PaginationOptions
  ): Promise<PaginatedResponse<Message>> {
    try {
      return await this.messageRepository.findByChannelId(channelId, options);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      logger.error({ error, channelId, options }, 'Failed to get channel messages');
      throw ApiError.internalError('Failed to get channel messages');
    }
  }

  /**
   * Delete message
   */
  async deleteMessage(id: string, userId: string): Promise<void> {
    try {
      logger.info({ messageId: id, userId }, 'Deleting message');

      // Get message
      const message = await this.messageRepository.findById(id);
      if (!message) {
        throw ApiError.notFound('Message', id);
      }

      // Check if user owns the message
      if (message.userId !== userId) {
        throw ApiError.forbidden('You can only delete your own messages');
      }

      // Delete message
      await this.messageRepository.delete(id);

      logger.info({ messageId: id }, 'Message deleted successfully');
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      logger.error({ error, messageId: id, userId }, 'Failed to delete message');
      throw ApiError.internalError('Message deletion failed');
    }
  }
}

// Export singleton instance
export const messageService = new MessageService();

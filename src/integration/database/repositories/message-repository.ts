/**
 * Message repository for database operations
 * Layer 3: Integration
 */

import { database } from '../connection-pool';
import {
  Message,
  CreateMessageInput,
  PaginationOptions,
  PaginatedResponse,
} from '@foundation/types/common-types';
import { ApiError } from '@foundation/errors/api-error';
import { logger } from '@infrastructure/logging/logger';

/**
 * Map database row to Message object
 */
function mapRowToMessage(row: any): Message {
  const message: any = {
    id: row.id,
    userId: row.user_id,
    content: row.content,
    createdAt: new Date(row.created_at),
  };

  if (row.recipient_id) message.recipientId = row.recipient_id;
  if (row.channel_id) message.channelId = row.channel_id;
  if (row.updated_at) message.updatedAt = new Date(row.updated_at);

  return message as Message;
}

/**
 * Message repository
 */
export class MessageRepository {
  /**
   * Create a new message
   */
  async create(input: CreateMessageInput): Promise<Message> {
    try {
      const result = await database.query<Message>(
        `INSERT INTO messages (user_id, content, recipient_id, channel_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id, user_id, content, recipient_id, channel_id, created_at, updated_at`,
        [input.userId, input.content, input.recipientId || null, input.channelId || null]
      );

      if (result.rows.length === 0) {
        throw new Error('Message creation returned no rows');
      }

      const message = mapRowToMessage(result.rows[0]);

      logger.info(
        {
          messageId: message.id,
          userId: input.userId,
          recipientId: input.recipientId,
          channelId: input.channelId,
        },
        'Message created'
      );

      return message;
    } catch (error) {
      logger.error({ error, input }, 'Failed to create message');
      throw ApiError.databaseError('Failed to create message');
    }
  }

  /**
   * Find message by ID
   */
  async findById(id: string): Promise<Message | null> {
    try {
      const result = await database.query<Message>(
        `SELECT id, user_id, content, recipient_id, channel_id, created_at, updated_at
         FROM messages
         WHERE id = $1`,
        [id]
      );

      return result.rows[0] ? mapRowToMessage(result.rows[0]) : null;
    } catch (error) {
      logger.error({ error, messageId: id }, 'Failed to find message by ID');
      throw ApiError.databaseError('Failed to find message');
    }
  }

  /**
   * Find messages with pagination
   */
  async findAll(options: PaginationOptions): Promise<PaginatedResponse<Message>> {
    try {
      const offset = (options.page - 1) * options.limit;

      // Get total count
      const countResult = await database.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM messages`
      );
      const total = parseInt(countResult.rows[0].count, 10);

      // Get paginated results
      const result = await database.query<Message>(
        `SELECT id, user_id, content, recipient_id, channel_id, created_at, updated_at
         FROM messages
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        [options.limit, offset]
      );

      const totalPages = Math.ceil(total / options.limit);
      return {
        data: result.rows.map(mapRowToMessage),
        pagination: {
          page: options.page,
          limit: options.limit,
          total,
          totalPages,
          hasNextPage: options.page < totalPages,
          hasPreviousPage: options.page > 1,
        },
      };
    } catch (error) {
      logger.error({ error, options }, 'Failed to find messages');
      throw ApiError.databaseError('Failed to find messages');
    }
  }

  /**
   * Find messages by user ID
   */
  async findByUserId(
    userId: string,
    options: PaginationOptions
  ): Promise<PaginatedResponse<Message>> {
    try {
      const offset = (options.page - 1) * options.limit;

      // Get total count
      const countResult = await database.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM messages WHERE user_id = $1`,
        [userId]
      );
      const total = parseInt(countResult.rows[0].count, 10);

      // Get paginated results
      const result = await database.query<Message>(
        `SELECT id, user_id, content, recipient_id, channel_id, created_at, updated_at
         FROM messages
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, options.limit, offset]
      );

      const totalPages = Math.ceil(total / options.limit);
      return {
        data: result.rows.map(mapRowToMessage),
        pagination: {
          page: options.page,
          limit: options.limit,
          total,
          totalPages,
          hasNextPage: options.page < totalPages,
          hasPreviousPage: options.page > 1,
        },
      };
    } catch (error) {
      logger.error({ error, userId, options }, 'Failed to find messages by user');
      throw ApiError.databaseError('Failed to find messages');
    }
  }

  /**
   * Find messages by channel ID
   */
  async findByChannelId(
    channelId: string,
    options: PaginationOptions
  ): Promise<PaginatedResponse<Message>> {
    try {
      const offset = (options.page - 1) * options.limit;

      // Get total count
      const countResult = await database.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM messages WHERE channel_id = $1`,
        [channelId]
      );
      const total = parseInt(countResult.rows[0].count, 10);

      // Get paginated results
      const result = await database.query<Message>(
        `SELECT id, user_id, content, recipient_id, channel_id, created_at, updated_at
         FROM messages
         WHERE channel_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [channelId, options.limit, offset]
      );

      const totalPages = Math.ceil(total / options.limit);
      return {
        data: result.rows.map(mapRowToMessage),
        pagination: {
          page: options.page,
          limit: options.limit,
          total,
          totalPages,
          hasNextPage: options.page < totalPages,
          hasPreviousPage: options.page > 1,
        },
      };
    } catch (error) {
      logger.error({ error, channelId, options }, 'Failed to find messages by channel');
      throw ApiError.databaseError('Failed to find messages');
    }
  }

  /**
   * Delete message
   */
  async delete(id: string): Promise<void> {
    try {
      const result = await database.query(`DELETE FROM messages WHERE id = $1`, [id]);

      if (result.rowCount === 0) {
        throw ApiError.notFound('Message', id);
      }

      logger.info({ messageId: id }, 'Message deleted');
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      logger.error({ error, messageId: id }, 'Failed to delete message');
      throw ApiError.databaseError('Failed to delete message');
    }
  }

  /**
   * Get message count
   */
  async count(): Promise<number> {
    try {
      const result = await database.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM messages`
      );

      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      logger.error({ error }, 'Failed to count messages');
      throw ApiError.databaseError('Failed to count messages');
    }
  }
}

// Export singleton instance
export const messageRepository = new MessageRepository();

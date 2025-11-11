/**
 * Message validation schemas
 * Layer 1: Foundation
 */

import { z } from 'zod';

/**
 * Message creation validation schema
 * Note: userId is added by the controller from authenticated user
 */
export const CreateMessageSchema = z.object({
  content: z
    .string()
    .min(1, 'Message content cannot be empty')
    .max(10000, 'Message content must be at most 10000 characters'),
  recipientId: z.string().uuid('Invalid recipient ID format').optional(),
  channelId: z.string().min(1, 'Channel ID cannot be empty').max(100, 'Channel ID too long').optional(),
}).refine(
  (data) => data.recipientId || data.channelId,
  {
    message: 'Either recipientId or channelId must be provided',
  }
);

/**
 * Message ID validation schema
 */
export const MessageIdSchema = z.object({
  id: z.string().uuid('Invalid message ID format'),
});

/**
 * Message query parameters validation schema (pagination)
 */
export const GetMessagesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Alias for backwards compatibility
 */
export const MessageQuerySchema = GetMessagesSchema;

/**
 * Validate message creation data
 */
export function validateCreateMessage(data: unknown) {
  return CreateMessageSchema.parse(data);
}

/**
 * Validate message ID
 */
export function validateMessageId(data: unknown) {
  return MessageIdSchema.parse(data);
}

/**
 * Validate message query parameters
 */
export function validateMessageQuery(data: unknown) {
  return MessageQuerySchema.parse(data);
}

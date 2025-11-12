/**
 * GraphQL Input Validators
 * Layer 4: Application
 *
 * Zod schemas for validating GraphQL mutation inputs
 */

import { z } from 'zod';

/**
 * Register input validator
 */
export const registerInputSchema = z.object({
  email: z.string().email('Invalid email address').min(1, 'Email is required'),
  name: z
    .string()
    .min(1, 'Name is required')
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must not exceed 72 characters (bcrypt limit)')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character'),
});

/**
 * Login input validator
 */
export const loginInputSchema = z.object({
  email: z.string().email('Invalid email address').min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * Update user input validator
 */
export const updateUserInputSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters')
    .optional(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must not exceed 72 characters (bcrypt limit)')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character')
    .optional(),
});

/**
 * Send message input validator
 */
export const sendMessageInputSchema = z
  .object({
    content: z
      .string()
      .min(1, 'Message content is required')
      .max(10000, 'Message must not exceed 10,000 characters'),
    recipientId: z.string().uuid('Invalid recipient ID').optional(),
    channelId: z.string().uuid('Invalid channel ID').optional(),
  })
  .refine((data) => data.recipientId || data.channelId, {
    message: 'Either recipientId or channelId must be provided',
  });

/**
 * Pagination options validator
 */
export const paginationOptionsSchema = z.object({
  page: z
    .number()
    .int('Page must be an integer')
    .min(1, 'Page must be at least 1')
    .max(10000, 'Page must not exceed 10,000')
    .optional()
    .default(1),
  limit: z
    .number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit must not exceed 100')
    .optional()
    .default(20),
});

/**
 * UUID validator for ID arguments
 */
export const uuidSchema = z.string().uuid('Invalid ID format');

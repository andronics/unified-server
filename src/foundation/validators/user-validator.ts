/**
 * User validation schemas
 * Layer 1: Foundation
 */

import { z } from 'zod';

/**
 * User creation validation schema
 */
export const CreateUserSchema = z.object({
  email: z
    .string()
    .email('Invalid email address')
    .max(255, 'Email must be at most 255 characters'),
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character'),
});

/**
 * User update validation schema
 */
export const UpdateUserSchema = z
  .object({
    email: z
      .string()
      .email('Invalid email address')
      .max(255, 'Email must be at most 255 characters')
      .optional(),
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name must be at most 100 characters')
      .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes')
      .optional(),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must be at most 128 characters')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character')
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

/**
 * Authentication credentials validation schema
 */
export const AuthCredentialsSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * User ID validation schema
 */
export const UserIdSchema = z.object({
  id: z.string().uuid('Invalid user ID format'),
});

/**
 * Validate user creation data
 */
export function validateCreateUser(data: unknown) {
  return CreateUserSchema.parse(data);
}

/**
 * Validate user update data
 */
export function validateUpdateUser(data: unknown) {
  return UpdateUserSchema.parse(data);
}

/**
 * Validate authentication credentials
 */
export function validateAuthCredentials(data: unknown) {
  return AuthCredentialsSchema.parse(data);
}

/**
 * Validate user ID
 */
export function validateUserId(data: unknown) {
  return UserIdSchema.parse(data);
}

/**
 * Unit tests for Zod validators
 */

import { describe, it, expect } from 'vitest';
import {
  CreateUserSchema,
  UpdateUserSchema,
  AuthCredentialsSchema,
} from '@foundation/validators/user-validator';
import {
  CreateMessageSchema,
  GetMessagesSchema,
} from '@foundation/validators/message-validator';

describe('User Validators', () => {
  describe('CreateUserSchema', () => {
    it('should validate valid user creation input', () => {
      const input = {
        email: 'test@example.com',
        name: 'Test User',
        password: 'Test123!@#',
      };

      const result = CreateUserSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const input = {
        email: 'invalid-email',
        name: 'Test User',
        password: 'Test123!@#',
      };

      const result = CreateUserSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject short name', () => {
      const input = {
        email: 'test@example.com',
        name: 'A',
        password: 'Test123!@#',
      };

      const result = CreateUserSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject weak password - no uppercase', () => {
      const input = {
        email: 'test@example.com',
        name: 'Test User',
        password: 'test123!@#',
      };

      const result = CreateUserSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject weak password - no lowercase', () => {
      const input = {
        email: 'test@example.com',
        name: 'Test User',
        password: 'TEST123!@#',
      };

      const result = CreateUserSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject weak password - no number', () => {
      const input = {
        email: 'test@example.com',
        name: 'Test User',
        password: 'TestTest!@#',
      };

      const result = CreateUserSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject weak password - no special character', () => {
      const input = {
        email: 'test@example.com',
        name: 'Test User',
        password: 'Test1234',
      };

      const result = CreateUserSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject weak password - too short', () => {
      const input = {
        email: 'test@example.com',
        name: 'Test User',
        password: 'Test1!',
      };

      const result = CreateUserSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('UpdateUserSchema', () => {
    it('should validate partial update', () => {
      const input = {
        name: 'Updated Name',
      };

      const result = UpdateUserSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate email update', () => {
      const input = {
        email: 'newemail@example.com',
      };

      const result = UpdateUserSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email in update', () => {
      const input = {
        email: 'invalid',
      };

      const result = UpdateUserSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('AuthCredentialsSchema', () => {
    it('should validate valid credentials', () => {
      const input = {
        email: 'test@example.com',
        password: 'anypassword',
      };

      const result = AuthCredentialsSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const input = {
        email: 'invalid',
        password: 'anypassword',
      };

      const result = AuthCredentialsSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject empty password', () => {
      const input = {
        email: 'test@example.com',
        password: '',
      };

      const result = AuthCredentialsSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});

describe('Message Validators', () => {
  describe('CreateMessageSchema', () => {
    it('should validate valid message', () => {
      const input = {
        content: 'Test message',
        recipientId: '123e4567-e89b-12d3-a456-426614174000',
      };

      const result = CreateMessageSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const input = {
        recipientId: 'invalid-uuid',
        content: 'Test message',
      };

      const result = CreateMessageSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject empty content', () => {
      const input = {
        recipientId: '123e4567-e89b-12d3-a456-426614174000',
        content: '',
      };

      const result = CreateMessageSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject content exceeding max length', () => {
      const input = {
        recipientId: '123e4567-e89b-12d3-a456-426614174000',
        content: 'a'.repeat(10001),
      };

      const result = CreateMessageSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('GetMessagesSchema', () => {
    it('should validate valid pagination params', () => {
      const input = {
        page: '1',
        limit: '20',
      };

      const result = GetMessagesSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
      }
    });

    it('should use default values when not provided', () => {
      const input = {};

      const result = GetMessagesSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
      }
    });

    it('should reject page less than 1', () => {
      const input = {
        page: '0',
      };

      const result = GetMessagesSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject limit exceeding max', () => {
      const input = {
        limit: '101',
      };

      const result = GetMessagesSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});

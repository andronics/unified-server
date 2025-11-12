/**
 * Unit tests for ApiError class
 */

import { describe, it, expect } from 'vitest';
import { ApiError, isApiError } from '@shared/errors/api-error';
import { ErrorCode } from '@shared/errors/error-codes';

describe('ApiError', () => {
  describe('Constructor', () => {
    it('should create error with all properties', () => {
      const error = new ApiError(
        'Test error',
        ErrorCode.INVALID_INPUT,
        { field: 'email' },
        false
      );

      expect(error.message).toBe('Test error');
      expect(error.code).toBe(ErrorCode.INVALID_INPUT);
      expect(error.httpStatus).toBe(400);
      expect(error.context).toEqual({ field: 'email' });
      expect(error.retryable).toBe(false);
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should use defaults when optional params omitted', () => {
      const error = new ApiError('Test error');

      expect(error.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(error.context).toEqual({});
      expect(error.retryable).toBe(false);
    });

    it('should have proper error name', () => {
      const error = new ApiError('Test error');
      expect(error.name).toBe('ApiError');
    });

    it('should capture stack trace', () => {
      const error = new ApiError('Test error');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('ApiError');
    });
  });

  describe('toHttpFormat', () => {
    it('should format error for HTTP response', () => {
      const error = new ApiError(
        'Validation failed',
        ErrorCode.VALIDATION_ERROR,
        { fields: ['email', 'password'] }
      );

      const formatted = error.toHttpFormat();

      expect(formatted.status).toBe(400);
      expect(formatted.body.success).toBe(false);
      expect(formatted.body.error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(formatted.body.error.message).toBe('Validation failed');
      expect(formatted.body.error.details).toEqual({ fields: ['email', 'password'] });
      expect(formatted.body.timestamp).toBeDefined();
    });

    it('should omit details when context is empty', () => {
      const error = new ApiError('Test error', ErrorCode.NOT_FOUND);
      const formatted = error.toHttpFormat();

      expect(formatted.body.error).not.toHaveProperty('details');
    });
  });

  describe('toJSON', () => {
    it('should serialize error to JSON', () => {
      const error = new ApiError(
        'Test error',
        ErrorCode.UNAUTHORIZED,
        { reason: 'invalid token' }
      );

      const json = error.toJSON();

      expect(json.name).toBe('ApiError');
      expect(json.message).toBe('Test error');
      expect(json.code).toBe(ErrorCode.UNAUTHORIZED);
      expect(json.httpStatus).toBe(401);
      expect(json.context).toEqual({ reason: 'invalid token' });
      expect(json.retryable).toBe(false);
      expect(json.timestamp).toBeDefined();
      expect(json.stack).toBeDefined();
    });
  });

  describe('isRetryable', () => {
    it('should return retryable status', () => {
      const retryableError = new ApiError('Error', ErrorCode.TIMEOUT, {}, true);
      const nonRetryableError = new ApiError('Error', ErrorCode.INVALID_INPUT, {}, false);

      expect(retryableError.isRetryable()).toBe(true);
      expect(nonRetryableError.isRetryable()).toBe(false);
    });
  });

  describe('Factory Methods', () => {
    describe('invalidInput', () => {
      it('should create invalid input error', () => {
        const error = ApiError.invalidInput('Invalid email format');

        expect(error.message).toBe('Invalid email format');
        expect(error.code).toBe(ErrorCode.INVALID_INPUT);
        expect(error.httpStatus).toBe(400);
        expect(error.retryable).toBe(false);
      });

      it('should include context', () => {
        const error = ApiError.invalidInput('Invalid field', { field: 'email' });

        expect(error.context).toEqual({ field: 'email' });
      });
    });

    describe('validationError', () => {
      it('should create validation error with errors', () => {
        const errors = [{ field: 'email', message: 'Invalid' }];
        const error = ApiError.validationError('Validation failed', errors);

        expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(error.context).toEqual({ errors });
        expect(error.retryable).toBe(false);
      });
    });

    describe('notFound', () => {
      it('should create not found error with resource', () => {
        const error = ApiError.notFound('User');

        expect(error.message).toBe('User not found');
        expect(error.code).toBe(ErrorCode.NOT_FOUND);
        expect(error.httpStatus).toBe(404);
        expect(error.context).toEqual({ resource: 'User', id: undefined });
      });

      it('should include ID in message and context', () => {
        const error = ApiError.notFound('User', '123');

        expect(error.message).toBe('User not found: 123');
        expect(error.context).toEqual({ resource: 'User', id: '123' });
      });
    });

    describe('unauthorized', () => {
      it('should create unauthorized error with default message', () => {
        const error = ApiError.unauthorized();

        expect(error.message).toBe('Authentication required');
        expect(error.code).toBe(ErrorCode.UNAUTHORIZED);
        expect(error.httpStatus).toBe(401);
        expect(error.retryable).toBe(false);
      });

      it('should accept custom message', () => {
        const error = ApiError.unauthorized('Token expired');

        expect(error.message).toBe('Token expired');
      });
    });

    describe('forbidden', () => {
      it('should create forbidden error', () => {
        const error = ApiError.forbidden();

        expect(error.message).toBe('Permission denied');
        expect(error.code).toBe(ErrorCode.FORBIDDEN);
        expect(error.httpStatus).toBe(403);
      });
    });

    describe('conflict', () => {
      it('should create conflict error', () => {
        const error = ApiError.conflict('Email already exists');

        expect(error.message).toBe('Email already exists');
        expect(error.code).toBe(ErrorCode.CONFLICT);
        expect(error.httpStatus).toBe(409);
      });
    });

    describe('rateLimited', () => {
      it('should create rate limited error', () => {
        const error = ApiError.rateLimited();

        expect(error.message).toBe('Too many requests');
        expect(error.code).toBe(ErrorCode.RATE_LIMITED);
        expect(error.httpStatus).toBe(429);
        expect(error.retryable).toBe(true);
      });
    });

    describe('internalError', () => {
      it('should create internal error', () => {
        const error = ApiError.internalError();

        expect(error.message).toBe('Internal server error');
        expect(error.code).toBe(ErrorCode.INTERNAL_ERROR);
        expect(error.httpStatus).toBe(500);
        expect(error.retryable).toBe(true);
      });
    });

    describe('databaseError', () => {
      it('should create database error', () => {
        const error = ApiError.databaseError('Connection failed');

        expect(error.message).toBe('Connection failed');
        expect(error.code).toBe(ErrorCode.DATABASE_ERROR);
        expect(error.retryable).toBe(true);
      });
    });

    describe('cacheError', () => {
      it('should create cache error', () => {
        const error = ApiError.cacheError('Redis unavailable');

        expect(error.message).toBe('Redis unavailable');
        expect(error.code).toBe(ErrorCode.CACHE_ERROR);
        expect(error.retryable).toBe(true);
      });
    });

    describe('timeout', () => {
      it('should create timeout error', () => {
        const error = ApiError.timeout();

        expect(error.message).toBe('Operation timed out');
        expect(error.code).toBe(ErrorCode.TIMEOUT);
        expect(error.retryable).toBe(true);
      });
    });

    describe('serviceUnavailable', () => {
      it('should create service unavailable error', () => {
        const error = ApiError.serviceUnavailable();

        expect(error.message).toBe('Service temporarily unavailable');
        expect(error.code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
        expect(error.httpStatus).toBe(503);
        expect(error.retryable).toBe(true);
      });
    });
  });
});

describe('isApiError type guard', () => {
  it('should return true for ApiError instances', () => {
    const error = new ApiError('Test');
    expect(isApiError(error)).toBe(true);
  });

  it('should return false for regular Error', () => {
    const error = new Error('Test');
    expect(isApiError(error)).toBe(false);
  });

  it('should return false for non-error objects', () => {
    expect(isApiError({})).toBe(false);
    expect(isApiError(null)).toBe(false);
    expect(isApiError(undefined)).toBe(false);
    expect(isApiError('error')).toBe(false);
  });
});

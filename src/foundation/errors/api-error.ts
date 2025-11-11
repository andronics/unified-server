/**
 * API Error class for standardized error handling
 * Layer 1: Foundation
 */

import { ErrorCode, ErrorCodeToHttpStatus } from './error-codes';

/**
 * Standard API Error with HTTP formatting
 */
export class ApiError extends Error {
  public readonly code: ErrorCode;
  public readonly httpStatus: number;
  public readonly context: Record<string, unknown>;
  public readonly timestamp: Date;
  public readonly retryable: boolean;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.INTERNAL_ERROR,
    context: Record<string, unknown> = {},
    retryable: boolean = false
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.httpStatus = ErrorCodeToHttpStatus[code];
    this.context = context;
    this.timestamp = new Date();
    this.retryable = retryable;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to HTTP response format
   */
  toHttpFormat(): {
    status: number;
    body: {
      success: false;
      error: {
        code: ErrorCode;
        message: string;
        details?: unknown;
      };
      timestamp: string;
    };
  } {
    return {
      status: this.httpStatus,
      body: {
        success: false,
        error: {
          code: this.code,
          message: this.message,
          ...(Object.keys(this.context).length > 0 && { details: this.context }),
        },
        timestamp: this.timestamp.toISOString(),
      },
    };
  }

  /**
   * Convert error to JSON for logging
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      httpStatus: this.httpStatus,
      context: this.context,
      retryable: this.retryable,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    };
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    return this.retryable;
  }

  /**
   * Factory methods for common errors
   */
  static invalidInput(message: string, context?: Record<string, unknown>): ApiError {
    return new ApiError(message, ErrorCode.INVALID_INPUT, context, false);
  }

  static validationError(message: string, errors: unknown): ApiError {
    return new ApiError(message, ErrorCode.VALIDATION_ERROR, { errors }, false);
  }

  static notFound(resource: string, id?: string): ApiError {
    return new ApiError(
      `${resource} not found${id ? `: ${id}` : ''}`,
      ErrorCode.NOT_FOUND,
      { resource, id },
      false
    );
  }

  static unauthorized(message: string = 'Authentication required'): ApiError {
    return new ApiError(message, ErrorCode.UNAUTHORIZED, {}, false);
  }

  static forbidden(message: string = 'Permission denied'): ApiError {
    return new ApiError(message, ErrorCode.FORBIDDEN, {}, false);
  }

  static conflict(message: string, context?: Record<string, unknown>): ApiError {
    return new ApiError(message, ErrorCode.CONFLICT, context, false);
  }

  static rateLimited(message: string = 'Too many requests'): ApiError {
    return new ApiError(message, ErrorCode.RATE_LIMITED, {}, true);
  }

  static internalError(message: string = 'Internal server error', context?: Record<string, unknown>): ApiError {
    return new ApiError(message, ErrorCode.INTERNAL_ERROR, context, true);
  }

  static databaseError(message: string, context?: Record<string, unknown>): ApiError {
    return new ApiError(message, ErrorCode.DATABASE_ERROR, context, true);
  }

  static cacheError(message: string, context?: Record<string, unknown>): ApiError {
    return new ApiError(message, ErrorCode.CACHE_ERROR, context, true);
  }

  static timeout(message: string = 'Operation timed out'): ApiError {
    return new ApiError(message, ErrorCode.TIMEOUT, {}, true);
  }

  static serviceUnavailable(message: string = 'Service temporarily unavailable'): ApiError {
    return new ApiError(message, ErrorCode.SERVICE_UNAVAILABLE, {}, true);
  }
}

/**
 * Type guard to check if error is ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

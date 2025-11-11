/**
 * Error codes used throughout the application
 * Layer 1: Foundation
 */

/**
 * Standard error codes (0-99)
 */
export enum ErrorCode {
  // Success
  SUCCESS = 0,

  // Client errors (1-49)
  INVALID_INPUT = 1,
  VALIDATION_ERROR = 2,
  NOT_FOUND = 3,
  UNAUTHORIZED = 4,
  FORBIDDEN = 5,
  CONFLICT = 6,
  RATE_LIMITED = 7,
  PAYLOAD_TOO_LARGE = 8,

  // Server errors (50-99)
  INTERNAL_ERROR = 50,
  DEPENDENCY_ERROR = 51,
  DATABASE_ERROR = 52,
  CACHE_ERROR = 53,
  TIMEOUT = 54,
  SERVICE_UNAVAILABLE = 55,
}

/**
 * Human-readable error messages
 */
export const ErrorMessages: Record<ErrorCode, string> = {
  [ErrorCode.SUCCESS]: 'Operation completed successfully',

  // Client errors
  [ErrorCode.INVALID_INPUT]: 'The provided input is invalid',
  [ErrorCode.VALIDATION_ERROR]: 'Validation failed',
  [ErrorCode.NOT_FOUND]: 'The requested resource was not found',
  [ErrorCode.UNAUTHORIZED]: 'Authentication is required',
  [ErrorCode.FORBIDDEN]: 'Permission denied',
  [ErrorCode.CONFLICT]: 'Resource conflict',
  [ErrorCode.RATE_LIMITED]: 'Too many requests',
  [ErrorCode.PAYLOAD_TOO_LARGE]: 'Request payload is too large',

  // Server errors
  [ErrorCode.INTERNAL_ERROR]: 'Internal server error',
  [ErrorCode.DEPENDENCY_ERROR]: 'External dependency unavailable',
  [ErrorCode.DATABASE_ERROR]: 'Database operation failed',
  [ErrorCode.CACHE_ERROR]: 'Cache operation failed',
  [ErrorCode.TIMEOUT]: 'Operation timed out',
  [ErrorCode.SERVICE_UNAVAILABLE]: 'Service temporarily unavailable',
};

/**
 * Map error codes to HTTP status codes
 */
export const ErrorCodeToHttpStatus: Record<ErrorCode, number> = {
  [ErrorCode.SUCCESS]: 200,

  // Client errors
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.PAYLOAD_TOO_LARGE]: 413,

  // Server errors
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.DEPENDENCY_ERROR]: 503,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.CACHE_ERROR]: 500,
  [ErrorCode.TIMEOUT]: 504,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
};

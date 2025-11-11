/**
 * Error handling middleware
 * Layer 4: Application
 */

import { Request, Response, NextFunction } from 'express';
import { ApiError, isApiError } from '@foundation/errors/api-error';
import { logger } from '@infrastructure/logging/logger';
import { ZodError } from 'zod';
import { ErrorCode } from '@foundation/errors/error-codes';

/**
 * Global error handler middleware
 * Must be registered last in middleware chain
 */
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log error with context
  logger.error(
    {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      request: {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body,
        correlationId: req.correlationId,
      },
    },
    'Request error'
  );

  // Handle ApiError
  if (isApiError(error)) {
    const { status, body } = error.toHttpFormat();
    res.status(status).json(body);
    return;
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const validationError = ApiError.validationError('Validation failed', error.errors);
    const { status, body } = validationError.toHttpFormat();
    res.status(status).json(body);
    return;
  }

  // Handle unknown errors
  const internalError = new ApiError(
    process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : error.message,
    ErrorCode.INTERNAL_ERROR,
    process.env.NODE_ENV === 'production' ? {} : { stack: error.stack },
    false
  );

  const { status, body } = internalError.toHttpFormat();
  res.status(status).json(body);
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  const error = ApiError.notFound('Route', req.path);
  const { status, body } = error.toHttpFormat();
  res.status(status).json(body);
}

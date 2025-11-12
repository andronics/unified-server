/**
 * Logging middleware
 * Layer 4: Application
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createRequestLogger } from '@infrastructure/logging/logger';

/**
 * Request logging middleware
 * Attaches correlation ID and logs requests
 */
export function loggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Generate or extract correlation ID
  const correlationId =
    (req.headers['x-correlation-id'] as string) ||
    (req.headers['x-request-id'] as string) ||
    uuidv4();

  // Attach to request
  req.correlationId = correlationId;

  // Set response header
  res.setHeader('X-Correlation-ID', correlationId);

  // Create request logger
  const requestLogger = createRequestLogger({
    requestId: correlationId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  const start = Date.now();

  // Log request
  requestLogger.info('HTTP request received');

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;

    requestLogger.info(
      {
        statusCode: res.statusCode,
        duration,
      },
      'HTTP request completed'
    );
  });

  next();
}

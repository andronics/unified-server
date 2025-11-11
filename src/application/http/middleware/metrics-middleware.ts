/**
 * Metrics middleware
 * Layer 4: Application
 */

import { Request, Response, NextFunction } from 'express';
import { metricsService } from '@infrastructure/metrics/metrics';

/**
 * Metrics collection middleware
 * Records HTTP request metrics
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  // Record metrics when response finishes
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const status = res.statusCode.toString();
    const method = req.method;
    const path = getRoutePath(req);

    // Record request count
    metricsService.httpRequestsTotal.inc({
      method,
      path,
      status,
    });

    // Record request duration
    metricsService.httpRequestDuration.observe(
      {
        method,
        path,
        status,
      },
      duration
    );

    // Record request size (if available)
    const requestSize = parseInt(req.get('content-length') || '0', 10);
    if (requestSize > 0) {
      metricsService.httpRequestSize.observe({ method, path }, requestSize);
    }

    // Record response size (if available)
    const responseSize = parseInt(res.get('content-length') || '0', 10);
    if (responseSize > 0) {
      metricsService.httpResponseSize.observe({ method, path }, responseSize);
    }
  });

  next();
}

/**
 * Extract route path (without parameters)
 * e.g., /users/123 → /users/:id
 */
function getRoutePath(req: Request): string {
  // If route is matched, use the route path
  if (req.route) {
    return req.route.path;
  }

  // Otherwise, use the base URL
  return req.baseUrl + (req.path || '');
}

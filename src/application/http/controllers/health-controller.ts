/**
 * Health check controller
 * Layer 4: Application
 */

import { Request, Response } from 'express';
import { database } from '@integration/database/connection-pool';
import { redisClient } from '@integration/cache/redis-client';
import { HealthStatus } from '@foundation/types/common-types';

/**
 * Get health status
 * GET /health
 */
export async function getHealth(_req: Request, res: Response): Promise<void> {

  // Check database
  let databaseStatus: 'up' | 'down' | 'degraded' = 'down';
  let databaseResponseTime: number | undefined;

  try {
    const dbStart = Date.now();
    const isHealthy = await database.healthCheck();
    databaseResponseTime = Date.now() - dbStart;
    databaseStatus = isHealthy ? 'up' : 'down';
  } catch (error) {
    databaseStatus = 'down';
  }

  // Check Redis
  let cacheStatus: 'up' | 'down' | 'degraded' = 'down';
  let cacheResponseTime: number | undefined;

  try {
    const cacheStart = Date.now();
    const isHealthy = await redisClient.healthCheck();
    cacheResponseTime = Date.now() - cacheStart;
    cacheStatus = isHealthy ? 'up' : 'down';
  } catch (error) {
    cacheStatus = 'down';
  }

  // Determine overall status
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy';

  if (databaseStatus === 'down') {
    overallStatus = 'unhealthy'; // Database is critical
  } else if (cacheStatus === 'down') {
    overallStatus = 'degraded'; // Cache is important but not critical
  } else {
    overallStatus = 'healthy';
  }

  const healthStatus: HealthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    dependencies: {
      database: {
        status: databaseStatus,
        responseTime: databaseResponseTime,
      },
      cache: {
        status: cacheStatus,
        responseTime: cacheResponseTime,
      },
    },
  };

  const statusCode = overallStatus === 'unhealthy' ? 503 : 200;
  res.status(statusCode).json(healthStatus);
}

/**
 * Readiness probe
 * GET /health/ready
 */
export async function getReadiness(_req: Request, res: Response): Promise<void> {
  try {
    const isDbHealthy = await database.healthCheck();

    if (isDbHealthy) {
      res.status(200).json({ status: 'ready' });
    } else {
      res.status(503).json({ status: 'not ready' });
    }
  } catch (error) {
    res.status(503).json({ status: 'not ready' });
  }
}

/**
 * Liveness probe
 * GET /health/live
 */
export function getLiveness(_req: Request, res: Response): void {
  res.status(200).json({ status: 'alive' });
}

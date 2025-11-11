/**
 * Authentication middleware
 * Layer 4: Application
 */

import { Request, Response, NextFunction } from 'express';
import { userService } from '@application/services/user-service';
import { ApiError } from '@foundation/errors/api-error';
import { logger } from '@infrastructure/logging/logger';
import { PublicUser } from '@foundation/types/common-types';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: PublicUser;
      correlationId?: string;
    }
  }
}

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw ApiError.unauthorized('Authorization header missing');
    }

    if (!authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Invalid authorization format. Use: Bearer <token>');
    }

    const token = authHeader.substring(7);

    // Verify token and get user
    const user = await userService.verifyToken(token);

    // Attach user to request
    req.user = user;

    logger.debug(
      {
        userId: user.id,
        path: req.path,
        correlationId: req.correlationId,
      },
      'User authenticated'
    );

    next();
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
    } else {
      logger.error({ error, path: req.path }, 'Authentication failed');
      next(ApiError.unauthorized('Authentication failed'));
    }
  }
}

/**
 * Optional authentication middleware
 * Attaches user if token is valid, but doesn't fail if not present
 */
export async function optionalAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const user = await userService.verifyToken(token);
      req.user = user;
    }

    next();
  } catch (error) {
    // Ignore errors for optional auth
    next();
  }
}

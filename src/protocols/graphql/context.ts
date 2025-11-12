/**
 * GraphQL Context Builder
 * Layer 4: Application
 *
 * Creates the context object passed to all GraphQL resolvers
 * Handles JWT authentication and request metadata
 */

import { Request } from 'express';
import { GraphQLContext } from '@shared/types/graphql-types';
import { userService } from '@domain/users/user.service';
import { logger } from '@infrastructure/logging/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Extract JWT token from Authorization header
 * Supports both Express Request and Fetch API Request
 */
function extractToken(req: Request | globalThis.Request): string | null {
  let authHeader: string | null = null;

  // Check if this is a Fetch API Request (GraphQL Yoga)
  if (req instanceof globalThis.Request) {
    authHeader = req.headers.get('authorization');
  } else {
    // Express Request
    authHeader = req.headers.authorization as string;
  }

  if (!authHeader) {
    return null;
  }

  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}

/**
 * Build GraphQL context for each request
 *
 * @param req - Express request object or Fetch API Request
 * @returns GraphQL context with optional authenticated user
 */
export async function buildGraphQLContext(req: Request | globalThis.Request): Promise<GraphQLContext> {
  // Generate correlation ID for request tracking
  let correlationId: string;

  if (req instanceof globalThis.Request) {
    correlationId = req.headers.get('x-correlation-id') || uuidv4();
  } else {
    correlationId = req.headers['x-correlation-id'] as string || uuidv4();
  }

  // Try to extract and verify JWT token
  const token = extractToken(req);

  if (token) {
    try {
      // Verify token and get full user object
      const user = await userService.verifyToken(token);

      logger.debug(
        {
          correlationId,
          userId: user.id,
          email: user.email,
        },
        'GraphQL request with authenticated user'
      );

      return {
        user,
        correlationId,
        req,
      };
    } catch (error) {
      // Invalid token - log but don't fail request
      // Some queries/mutations don't require auth
      logger.warn(
        {
          correlationId,
          error,
        },
        'Invalid JWT token in GraphQL request'
      );
    }
  }

  // Unauthenticated request
  return {
    correlationId,
    req,
  };
}

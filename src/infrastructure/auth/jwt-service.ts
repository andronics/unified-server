/**
 * JWT token generation and verification service
 * Layer 2: Infrastructure
 */

import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../config/config-loader';
import { logger } from '../logging/logger';
import { ApiError } from '@foundation/errors/api-error';

/**
 * JWT payload structure
 */
export interface JwtPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

/**
 * JWT service for token generation and verification
 */
export class JwtService {
  private readonly secret: string;
  private readonly expiresIn: string;
  private readonly refreshExpiresIn: string;

  constructor() {
    this.secret = config.auth.jwtSecret;
    this.expiresIn = config.auth.jwtExpiresIn;
    this.refreshExpiresIn = config.auth.jwtRefreshExpiresIn;

    if (this.secret.length < 32) {
      throw new Error('JWT secret must be at least 32 characters');
    }
  }

  /**
   * Generate an access token
   * @param payload - Data to encode in token
   * @returns JWT token
   */
  generateAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
    try {
      const token = jwt.sign(payload, this.secret, {
        expiresIn: this.expiresIn as any,
      } as SignOptions);

      logger.debug(
        {
          userId: payload.userId,
          expiresIn: this.expiresIn,
        },
        'Access token generated'
      );

      return token;
    } catch (error) {
      logger.error({ error, userId: payload.userId }, 'Failed to generate access token');
      throw ApiError.internalError('Token generation failed');
    }
  }

  /**
   * Generate a refresh token
   * @param payload - Data to encode in token
   * @returns JWT refresh token
   */
  generateRefreshToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
    try {
      const token = jwt.sign(payload, this.secret, {
        expiresIn: this.refreshExpiresIn as any,
      } as SignOptions);

      logger.debug(
        {
          userId: payload.userId,
          expiresIn: this.refreshExpiresIn,
        },
        'Refresh token generated'
      );

      return token;
    } catch (error) {
      logger.error({ error, userId: payload.userId }, 'Failed to generate refresh token');
      throw ApiError.internalError('Token generation failed');
    }
  }

  /**
   * Verify and decode a token
   * @param token - JWT token to verify
   * @returns Decoded token payload
   * @throws ApiError if token is invalid or expired
   */
  verifyToken(token: string): JwtPayload {
    try {
      const decoded = jwt.verify(token, this.secret, {
        algorithms: ['HS256'],
      }) as JwtPayload;

      logger.debug(
        {
          userId: decoded.userId,
        },
        'Token verified successfully'
      );

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        logger.debug('Token verification failed: expired');
        throw ApiError.unauthorized('Token has expired');
      }

      if (error instanceof jwt.JsonWebTokenError) {
        logger.debug({ error: error.message }, 'Token verification failed: invalid');
        throw ApiError.unauthorized('Invalid token');
      }

      logger.error({ error }, 'Token verification failed with unexpected error');
      throw ApiError.unauthorized('Token verification failed');
    }
  }

  /**
   * Decode a token without verification (useful for debugging)
   * @param token - JWT token to decode
   * @returns Decoded token payload or null if invalid
   */
  decodeToken(token: string): JwtPayload | null {
    try {
      const decoded = jwt.decode(token) as JwtPayload;
      return decoded;
    } catch (error) {
      logger.warn({ error }, 'Failed to decode token');
      return null;
    }
  }

  /**
   * Check if a token is expired without throwing an error
   * @param token - JWT token to check
   * @returns True if token is expired
   */
  isTokenExpired(token: string): boolean {
    try {
      const decoded = this.decodeToken(token);
      if (!decoded || !decoded.exp) {
        return true;
      }

      const now = Math.floor(Date.now() / 1000);
      return decoded.exp < now;
    } catch (error) {
      return true;
    }
  }

  /**
   * Get the time until token expiration in seconds
   * @param token - JWT token
   * @returns Seconds until expiration, or 0 if expired/invalid
   */
  getTokenExpiresIn(token: string): number {
    try {
      const decoded = this.decodeToken(token);
      if (!decoded || !decoded.exp) {
        return 0;
      }

      const now = Math.floor(Date.now() / 1000);
      const expiresIn = decoded.exp - now;
      return Math.max(0, expiresIn);
    } catch (error) {
      return 0;
    }
  }
}

// Export singleton instance
export const jwtService = new JwtService();

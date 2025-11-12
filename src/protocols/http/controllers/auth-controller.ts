/**
 * Authentication controller
 * Layer 4: Application
 */

import { Request, Response, NextFunction } from 'express';
import { userService } from '@domain/users/user.service';

/**
 * Register a new user
 * POST /auth/register
 */
export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await userService.createUser(req.body);

    res.status(201).json({
      success: true,
      data: user,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Login user
 * POST /auth/login
 */
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authResponse = await userService.authenticate(req.body);

    res.status(200).json({
      success: true,
      data: authResponse,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get current user (from JWT token)
 * GET /auth/me
 */
export async function getCurrentUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      const { ApiError } = await import('@shared/errors/api-error');
      throw ApiError.unauthorized('User not authenticated');
    }

    res.status(200).json({
      success: true,
      data: req.user,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

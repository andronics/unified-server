/**
 * User controller
 * Layer 4: Application
 */

import { Request, Response, NextFunction } from 'express';
import { userService } from '@domain/users/user.service';
import { ApiError } from '@shared/errors/api-error';

/**
 * Get user by ID
 * GET /users/:id
 */
export async function getUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await userService.getUser(req.params.id);

    res.status(200).json({
      success: true,
      data: user,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update user
 * PUT /users/:id
 */
export async function updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Users can only update their own profile
    if (req.user?.id !== req.params.id) {
      throw ApiError.forbidden('You can only update your own profile');
    }

    const user = await userService.updateUser(req.params.id, req.body);

    res.status(200).json({
      success: true,
      data: user,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete user
 * DELETE /users/:id
 */
export async function deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Users can only delete their own profile
    if (req.user?.id !== req.params.id) {
      throw ApiError.forbidden('You can only delete your own profile');
    }

    await userService.deleteUser(req.params.id);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

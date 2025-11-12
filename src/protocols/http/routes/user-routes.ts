/**
 * User routes
 * Layer 4: Application
 */

import { Router } from 'express';
import * as userController from '../controllers/user-controller';
import { validateBody, validateParams } from '../middleware/validation-middleware';
import { authMiddleware } from '../middleware/auth-middleware';
import { UpdateUserSchema, UserIdSchema } from '@domain/users/user.validator';

const router = Router();

// All user routes require authentication
router.use(authMiddleware);

/**
 * GET /users/:id
 * Get user by ID
 */
router.get('/:id', validateParams(UserIdSchema), userController.getUser);

/**
 * PUT /users/:id
 * Update user
 */
router.put(
  '/:id',
  validateParams(UserIdSchema),
  validateBody(UpdateUserSchema),
  userController.updateUser
);

/**
 * DELETE /users/:id
 * Delete user
 */
router.delete('/:id', validateParams(UserIdSchema), userController.deleteUser);

export default router;

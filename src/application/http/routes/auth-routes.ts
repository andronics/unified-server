/**
 * Authentication routes
 * Layer 4: Application
 */

import { Router } from 'express';
import * as authController from '../controllers/auth-controller';
import { validateBody } from '../middleware/validation-middleware';
import { authMiddleware } from '../middleware/auth-middleware';
import { CreateUserSchema, AuthCredentialsSchema } from '@foundation/validators/user-validator';

const router = Router();

/**
 * POST /auth/register
 * Register a new user
 */
router.post('/register', validateBody(CreateUserSchema), authController.register);

/**
 * POST /auth/login
 * Login user and get JWT token
 */
router.post('/login', validateBody(AuthCredentialsSchema), authController.login);

/**
 * GET /auth/me
 * Get current authenticated user
 */
router.get('/me', authMiddleware, authController.getCurrentUser);

export default router;

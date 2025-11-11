/**
 * Health check routes
 * Layer 4: Application
 */

import { Router } from 'express';
import * as healthController from '../controllers/health-controller';

const router = Router();

/**
 * GET /health
 * Get overall health status
 */
router.get('/', healthController.getHealth);

/**
 * GET /health/ready
 * Kubernetes readiness probe
 */
router.get('/ready', healthController.getReadiness);

/**
 * GET /health/live
 * Kubernetes liveness probe
 */
router.get('/live', healthController.getLiveness);

export default router;

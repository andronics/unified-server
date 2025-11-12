/**
 * Message routes
 * Layer 4: Application
 */

import { Router } from 'express';
import * as messageController from '../controllers/message-controller';
import { validateBody, validateParams, validateQuery } from '../middleware/validation-middleware';
import { authMiddleware } from '../middleware/auth-middleware';
import { CreateMessageSchema, MessageIdSchema, MessageQuerySchema } from '@domain/messages/message.validator';

const router = Router();

// All message routes require authentication
router.use(authMiddleware);

/**
 * POST /messages
 * Send a message
 */
router.post('/', validateBody(CreateMessageSchema), messageController.sendMessage);

/**
 * GET /messages
 * Get all messages with pagination
 * Query params: page, limit, userId, channelId
 */
router.get('/', validateQuery(MessageQuerySchema), messageController.getMessages);

/**
 * GET /messages/user/:userId
 * Get messages by user ID
 */
router.get('/user/:userId', messageController.getMessages);

/**
 * GET /messages/:id
 * Get message by ID
 */
router.get('/:id', validateParams(MessageIdSchema), messageController.getMessage);

/**
 * DELETE /messages/:id
 * Delete message
 */
router.delete('/:id', validateParams(MessageIdSchema), messageController.deleteMessage);

export default router;

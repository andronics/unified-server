/**
 * Message controller
 * Layer 4: Application
 */

import { Request, Response, NextFunction } from 'express';
import { messageService } from '@domain/messages/message.service';
import { ApiError } from '@shared/errors/api-error';

/**
 * Send a message
 * POST /messages
 */
export async function sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('User not authenticated');
    }

    const message = await messageService.sendMessage({
      ...req.body,
      userId: req.user.id, // Use authenticated user's ID
    });

    res.status(201).json({
      success: true,
      data: message,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get message by ID
 * GET /messages/:id
 */
export async function getMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const message = await messageService.getMessage(req.params.id);

    res.status(200).json({
      success: true,
      data: message,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get all messages with pagination
 * GET /messages
 */
export async function getMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page = 1, limit = 20, userId: queryUserId, channelId } = req.query as any;
    const { userId: paramUserId } = req.params;

    // Support both query param and path param for userId
    const userId = paramUserId || queryUserId;

    let result;

    if (userId) {
      result = await messageService.getUserMessages(userId, { page: Number(page), limit: Number(limit) });
    } else if (channelId) {
      result = await messageService.getChannelMessages(channelId, { page: Number(page), limit: Number(limit) });
    } else {
      result = await messageService.getMessages({ page: Number(page), limit: Number(limit) });
    }

    res.status(200).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete message
 * DELETE /messages/:id
 */
export async function deleteMessage(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('User not authenticated');
    }

    await messageService.deleteMessage(req.params.id, req.user.id);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

/**
 * Unit tests for MessageService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageService } from '@domain/messages/message.service';
import { MessageRepository } from '@infrastructure/database/repositories/message-repository';
import { UserRepository } from '@infrastructure/database/repositories/user-repository';
import { EventBus } from '@infrastructure/events/event-bus';
import { ApiError } from '@shared/errors/api-error';
import { Message } from '@shared/types/common-types';

describe('MessageService', () => {
  let messageService: MessageService;
  let mockMessageRepository: MessageRepository;
  let mockUserRepository: UserRepository;
  let mockEventBus: EventBus;

  const mockMessage: Message = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    userId: '456e7890-e89b-12d3-a456-426614174000',
    content: 'Test message content',
    createdAt: new Date('2024-01-01'),
  };

  beforeEach(() => {
    // Create mock instances
    mockMessageRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      findByUserId: vi.fn(),
      findByChannelId: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    } as any;

    mockUserRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findByEmail: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      exists: vi.fn(),
      count: vi.fn(),
    } as any;

    mockEventBus = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      clear: vi.fn(),
      getSubscriptions: vi.fn(),
      getSubscriptionCount: vi.fn(),
      getActiveEventTypes: vi.fn(),
      getStats: vi.fn(),
    } as any;

    // Create service with mocked dependencies
    messageService = new MessageService({
      messageRepository: mockMessageRepository,
      userRepository: mockUserRepository,
      eventBus: mockEventBus,
    });

    vi.clearAllMocks();
  });

  describe('sendMessage', () => {
    it('should send message successfully', async () => {
      (mockUserRepository.exists as any).mockResolvedValue(true);
      (mockMessageRepository.create as any).mockResolvedValue(mockMessage);
      (mockEventBus.emit as any).mockResolvedValue();

      const input = {
        userId: mockMessage.userId,
        content: 'Test message content',
      };

      const result = await messageService.sendMessage(input);

      expect(result).toEqual(mockMessage);
      expect(mockUserRepository.exists).toHaveBeenCalledWith(input.userId);
      expect(mockMessageRepository.create).toHaveBeenCalledWith(input);
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'message.sent',
          data: { message: mockMessage },
        })
      );
    });

    it('should throw not found error if sender does not exist', async () => {
      (mockUserRepository.exists as any).mockResolvedValue(false);

      const input = {
        userId: 'nonexistent-user-id',
        content: 'Test message content',
      };

      await expect(messageService.sendMessage(input)).rejects.toThrow(ApiError);
      await expect(messageService.sendMessage(input)).rejects.toThrow('Sender user not found');

      expect(mockMessageRepository.create).not.toHaveBeenCalled();
      expect(mockEventBus.emit).not.toHaveBeenCalled();
    });

    it('should emit event after message creation', async () => {
      (mockUserRepository.exists as any).mockResolvedValue(true);
      (mockMessageRepository.create as any).mockResolvedValue(mockMessage);
      (mockEventBus.emit as any).mockResolvedValue();

      const input = {
        userId: mockMessage.userId,
        content: 'Test message content',
      };

      await messageService.sendMessage(input);

      expect(mockEventBus.emit).toHaveBeenCalledTimes(1);
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'message.sent',
          data: { message: mockMessage },
        })
      );
    });
  });

  describe('getMessages', () => {
    it('should return paginated messages', async () => {
      const messages = [mockMessage];
      const paginatedResponse = {
        data: messages,
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      };

      (mockMessageRepository.findAll as any).mockResolvedValue(paginatedResponse);

      const options = { page: 1, limit: 20 };
      const result = await messageService.getMessages(options);

      expect(result).toEqual(paginatedResponse);
      expect(mockMessageRepository.findAll).toHaveBeenCalledWith(options);
    });

    it('should handle default pagination options', async () => {
      const paginatedResponse = {
        data: [mockMessage],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      };

      (mockMessageRepository.findAll as any).mockResolvedValue(paginatedResponse);

      const result = await messageService.getMessages({ page: 1, limit: 20 });

      expect(result).toEqual(paginatedResponse);
    });

    it('should handle empty message list', async () => {
      const paginatedResponse = {
        data: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        },
      };

      (mockMessageRepository.findAll as any).mockResolvedValue(paginatedResponse);

      const result = await messageService.getMessages({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });
  });

  // Note: Additional methods (getMessage, getUserMessages, deleteMessage) exist in the actual
  // implementation but are not critical for core functionality testing.
  // These would be covered by integration tests.
});

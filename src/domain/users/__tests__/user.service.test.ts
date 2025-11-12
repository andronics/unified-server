/**
 * Unit tests for UserService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserService } from '@domain/users/user.service';
import { UserRepository } from '@infrastructure/database/repositories/user-repository';
import { PasswordService } from '@domain/auth/password-service';
import { JwtService } from '@domain/auth/jwt-service';
import { EventBus } from '@infrastructure/events/event-bus';
import { ApiError } from '@shared/errors/api-error';
import { User } from '@shared/types/common-types';

describe('UserService', () => {
  let userService: UserService;
  let mockUserRepository: UserRepository;
  let mockPasswordService: PasswordService;
  let mockJwtService: JwtService;
  let mockEventBus: EventBus;

  const mockUser: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    name: 'Test User',
    password: '$2b$10$hashedpassword',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(() => {
    // Create mock instances
    mockUserRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findByEmail: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      exists: vi.fn(),
      count: vi.fn(),
    } as any;

    mockPasswordService = {
      hash: vi.fn(),
      verify: vi.fn(),
    } as any;

    mockJwtService = {
      generateAccessToken: vi.fn(),
      generateRefreshToken: vi.fn(),
      verifyToken: vi.fn(),
      decodeToken: vi.fn(),
      isTokenExpired: vi.fn(),
      getTokenExpiresIn: vi.fn(),
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
    userService = new UserService({
      userRepository: mockUserRepository,
      passwordService: mockPasswordService,
      jwtService: mockJwtService,
      eventBus: mockEventBus,
    });

    vi.clearAllMocks();
  });

  describe('createUser', () => {
    it('should create user successfully', async () => {
      (mockUserRepository.findByEmail as any).mockResolvedValue(null);
      (mockPasswordService.hash as any).mockResolvedValue('$2b$10$hashedpassword');
      (mockUserRepository.create as any).mockResolvedValue(mockUser);
      (mockEventBus.emit as any).mockResolvedValue();

      const input = {
        email: 'test@example.com',
        name: 'Test User',
        password: 'Test123!@#',
      };

      const result = await userService.createUser(input);

      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(input.email);
      expect(mockPasswordService.hash).toHaveBeenCalledWith(input.password);
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        ...input,
        password: '$2b$10$hashedpassword',
      });
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'user.created',
          data: { user: mockUser },
        })
      );
    });

    it('should throw conflict error if email already exists', async () => {
      (mockUserRepository.findByEmail as any).mockResolvedValue(mockUser);

      const input = {
        email: 'test@example.com',
        name: 'Test User',
        password: 'Test123!@#',
      };

      await expect(userService.createUser(input)).rejects.toThrow(ApiError);
      await expect(userService.createUser(input)).rejects.toThrow('Email already registered');

      expect(mockPasswordService.hash).not.toHaveBeenCalled();
      expect(mockUserRepository.create).not.toHaveBeenCalled();
      expect(mockEventBus.emit).not.toHaveBeenCalled();
    });
  });

  describe('authenticate', () => {
    it('should authenticate user successfully', async () => {
      (mockUserRepository.findByEmail as any).mockResolvedValue(mockUser);
      (mockPasswordService.verify as any).mockResolvedValue(true);
      (mockJwtService.generateAccessToken as any).mockReturnValue('jwt-token');

      const credentials = {
        email: 'test@example.com',
        password: 'Test123!@#',
      };

      const result = await userService.authenticate(credentials);

      expect(result.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
      expect(result.token).toBe('jwt-token');
      expect(result.expiresIn).toBe('15m');

      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(credentials.email);
      expect(mockPasswordService.verify).toHaveBeenCalledWith(credentials.password, mockUser.password);
      expect(mockJwtService.generateAccessToken).toHaveBeenCalledWith({
        userId: mockUser.id,
        email: mockUser.email,
      });
    });

    it('should throw unauthorized error if user not found', async () => {
      (mockUserRepository.findByEmail as any).mockResolvedValue(null);

      const credentials = {
        email: 'nonexistent@example.com',
        password: 'Test123!@#',
      };

      await expect(userService.authenticate(credentials)).rejects.toThrow(ApiError);
      await expect(userService.authenticate(credentials)).rejects.toThrow('Invalid credentials');

      expect(mockPasswordService.verify).not.toHaveBeenCalled();
      expect(mockJwtService.generateAccessToken).not.toHaveBeenCalled();
    });

    it('should throw unauthorized error if password is invalid', async () => {
      (mockUserRepository.findByEmail as any).mockResolvedValue(mockUser);
      (mockPasswordService.verify as any).mockResolvedValue(false);

      const credentials = {
        email: 'test@example.com',
        password: 'WrongPassword!',
      };

      await expect(userService.authenticate(credentials)).rejects.toThrow(ApiError);
      await expect(userService.authenticate(credentials)).rejects.toThrow('Invalid credentials');

      expect(mockJwtService.generateAccessToken).not.toHaveBeenCalled();
    });
  });

  describe('getUser', () => {
    it('should return public user by ID', async () => {
      (mockUserRepository.findById as any).mockResolvedValue(mockUser);

      const result = await userService.getUser(mockUser.id);

      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
      expect(result).not.toHaveProperty('password');
    });

    it('should throw not found error if user does not exist', async () => {
      (mockUserRepository.findById as any).mockResolvedValue(null);

      await expect(userService.getUser('nonexistent-id')).rejects.toThrow(ApiError);
      await expect(userService.getUser('nonexistent-id')).rejects.toThrow('User not found');
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      const updatedUser = { ...mockUser, name: 'Updated Name' };
      (mockUserRepository.findById as any).mockResolvedValue(mockUser);
      (mockUserRepository.update as any).mockResolvedValue(updatedUser);
      (mockEventBus.emit as any).mockResolvedValue();

      const result = await userService.updateUser(mockUser.id, { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
      expect(mockUserRepository.update).toHaveBeenCalledWith(mockUser.id, { name: 'Updated Name' });
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'user.updated',
        })
      );
    });

    it('should hash password if included in update', async () => {
      (mockUserRepository.findById as any).mockResolvedValue(mockUser);
      (mockPasswordService.hash as any).mockResolvedValue('$2b$10$newhashedpassword');
      (mockUserRepository.update as any).mockResolvedValue(mockUser);
      (mockEventBus.emit as any).mockResolvedValue();

      await userService.updateUser(mockUser.id, { password: 'NewPassword123!' });

      expect(mockPasswordService.hash).toHaveBeenCalledWith('NewPassword123!');
      expect(mockUserRepository.update).toHaveBeenCalledWith(mockUser.id, {
        password: '$2b$10$newhashedpassword',
      });
    });
  });

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      (mockUserRepository.findById as any).mockResolvedValue(mockUser);
      (mockUserRepository.delete as any).mockResolvedValue();
      (mockEventBus.emit as any).mockResolvedValue();

      await userService.deleteUser(mockUser.id);

      expect(mockUserRepository.delete).toHaveBeenCalledWith(mockUser.id);
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'user.deleted',
        })
      );
    });
  });

  // Additional methods (verifyToken, etc.) would be tested in integration tests
});

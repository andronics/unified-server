/**
 * User service with business logic
 * Layer 4: Application
 */

import { v4 as uuidv4 } from 'uuid';
import {
  User,
  PublicUser,
  CreateUserInput,
  UpdateUserInput,
  AuthCredentials,
  AuthResponse,
} from '@foundation/types/common-types';
import { ApiError } from '@foundation/errors/api-error';
import type { UserRepository } from '@integration/database/repositories/user-repository';
import type { PasswordService } from '@infrastructure/auth/password-service';
import type { JwtService } from '@infrastructure/auth/jwt-service';
import type { EventBus } from '@infrastructure/events/event-bus';
import { userRepository } from '@integration/database/repositories/user-repository';
import { passwordService } from '@infrastructure/auth/password-service';
import { jwtService } from '@infrastructure/auth/jwt-service';
import { eventBus } from '@infrastructure/events/event-bus';
import { logger } from '@infrastructure/logging/logger';
import { metricsService } from '@infrastructure/metrics/metrics';
import { UserCreatedEvent, UserUpdatedEvent, UserDeletedEvent } from '@foundation/types/event-types';

/**
 * User service
 */
export class UserService {
  private userRepository: UserRepository;
  private passwordService: PasswordService;
  private jwtService: JwtService;
  private eventBus: EventBus;

  constructor(
    deps?: {
      userRepository?: UserRepository;
      passwordService?: PasswordService;
      jwtService?: JwtService;
      eventBus?: EventBus;
    }
  ) {
    this.userRepository = deps?.userRepository || userRepository;
    this.passwordService = deps?.passwordService || passwordService;
    this.jwtService = deps?.jwtService || jwtService;
    this.eventBus = deps?.eventBus || eventBus;
  }
  /**
   * Convert User to PublicUser (remove sensitive fields)
   */
  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Create a new user
   */
  async createUser(input: CreateUserInput): Promise<PublicUser> {
    try {
      logger.info({ email: input.email }, 'Creating user');

      // Check if user already exists
      const existingUser = await this.userRepository.findByEmail(input.email);
      if (existingUser) {
        throw ApiError.conflict('Email already registered');
      }

      // Hash password
      const hashedPassword = await this.passwordService.hash(input.password);

      // Create user
      const user = await this.userRepository.create({
        ...input,
        password: hashedPassword,
      });

      // Emit event
      const event: UserCreatedEvent = {
        eventId: uuidv4(),
        eventType: 'user.created',
        timestamp: new Date(),
        data: { user },
      };
      await this.eventBus.emit(event);

      logger.info({ userId: user.id }, 'User created successfully');

      return this.toPublicUser(user);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      logger.error({ error, input }, 'Failed to create user');
      throw ApiError.internalError('User creation failed');
    }
  }

  /**
   * Authenticate user and generate JWT token
   */
  async authenticate(credentials: AuthCredentials): Promise<AuthResponse> {
    try {
      logger.info({ email: credentials.email }, 'Authenticating user');

      metricsService.authAttemptsTotal.inc({ method: 'password' });

      // Find user by email
      const user = await this.userRepository.findByEmail(credentials.email);
      if (!user) {
        metricsService.authFailuresTotal.inc({ method: 'password', reason: 'user_not_found' });
        throw ApiError.unauthorized('Invalid credentials');
      }

      // Verify password
      const isPasswordValid = await this.passwordService.verify(credentials.password, user.password);
      if (!isPasswordValid) {
        metricsService.authFailuresTotal.inc({ method: 'password', reason: 'invalid_password' });
        throw ApiError.unauthorized('Invalid credentials');
      }

      // Generate JWT token
      const token = this.jwtService.generateAccessToken({
        userId: user.id,
        email: user.email,
      });

      metricsService.authSuccessTotal.inc({ method: 'password' });

      logger.info({ userId: user.id }, 'User authenticated successfully');

      return {
        user: this.toPublicUser(user),
        token,
        expiresIn: '15m',
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      logger.error({ error, email: credentials.email }, 'Authentication failed');
      throw ApiError.internalError('Authentication failed');
    }
  }

  /**
   * Get user by ID
   */
  async getUser(id: string): Promise<PublicUser> {
    try {
      const user = await this.userRepository.findById(id);

      if (!user) {
        throw ApiError.notFound('User', id);
      }

      return this.toPublicUser(user);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      logger.error({ error, userId: id }, 'Failed to get user');
      throw ApiError.internalError('Failed to get user');
    }
  }

  /**
   * Update user
   */
  async updateUser(id: string, input: UpdateUserInput): Promise<PublicUser> {
    try {
      logger.info({ userId: id }, 'Updating user');

      // Check if user exists
      const existingUser = await this.userRepository.findById(id);
      if (!existingUser) {
        throw ApiError.notFound('User', id);
      }

      // Hash password if provided
      if (input.password) {
        input.password = await this.passwordService.hash(input.password);
      }

      // Update user
      const updatedUser = await this.userRepository.update(id, input);

      // Emit event
      const event: UserUpdatedEvent = {
        eventId: uuidv4(),
        eventType: 'user.updated',
        timestamp: new Date(),
        data: {
          userId: id,
          changes: input,
        },
      };
      await this.eventBus.emit(event);

      logger.info({ userId: id }, 'User updated successfully');

      return this.toPublicUser(updatedUser);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      logger.error({ error, userId: id, input }, 'Failed to update user');
      throw ApiError.internalError('User update failed');
    }
  }

  /**
   * Delete user
   */
  async deleteUser(id: string): Promise<void> {
    try {
      logger.info({ userId: id }, 'Deleting user');

      // Check if user exists
      const existingUser = await this.userRepository.findById(id);
      if (!existingUser) {
        throw ApiError.notFound('User', id);
      }

      // Delete user
      await this.userRepository.delete(id);

      // Emit event
      const event: UserDeletedEvent = {
        eventId: uuidv4(),
        eventType: 'user.deleted',
        timestamp: new Date(),
        data: { userId: id },
      };
      await this.eventBus.emit(event);

      logger.info({ userId: id }, 'User deleted successfully');
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      logger.error({ error, userId: id }, 'Failed to delete user');
      throw ApiError.internalError('User deletion failed');
    }
  }

  /**
   * Verify JWT token and get user
   */
  async verifyToken(token: string): Promise<PublicUser> {
    try {
      const payload = this.jwtService.verifyToken(token);
      const user = await this.getUser(payload.userId);
      return user;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      logger.error({ error }, 'Token verification failed');
      throw ApiError.unauthorized('Invalid token');
    }
  }
}

// Export singleton instance
export const userService = new UserService();

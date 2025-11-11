/**
 * Common types used throughout the application
 * Layer 1: Foundation
 */

/**
 * User entity representing an authenticated user
 */
export interface User {
  id: string;
  email: string;
  name: string;
  password: string; // Hashed
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Public user data (without sensitive fields)
 */
export interface PublicUser {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User creation input
 */
export interface CreateUserInput {
  email: string;
  name: string;
  password: string;
}

/**
 * User update input
 */
export interface UpdateUserInput {
  email?: string;
  name?: string;
  password?: string;
}

/**
 * Message entity
 */
export interface Message {
  id: string;
  userId: string;
  content: string;
  recipientId?: string;
  channelId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Message creation input
 */
export interface CreateMessageInput {
  userId: string;
  content: string;
  recipientId?: string;
  channelId?: string;
}

/**
 * Session data for authenticated users
 */
export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page: number;
  limit: number;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

/**
 * Health check status
 */
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  dependencies: {
    database: DependencyHealth;
    cache: DependencyHealth;
  };
}

/**
 * Individual dependency health
 */
export interface DependencyHealth {
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  error?: string;
}

/**
 * Authentication credentials
 */
export interface AuthCredentials {
  email: string;
  password: string;
}

/**
 * Authentication response
 */
export interface AuthResponse {
  user: PublicUser;
  token: string;
  refreshToken?: string;
  expiresIn: string;
}

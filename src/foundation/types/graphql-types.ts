/**
 * GraphQL-specific types
 * Layer 1: Foundation
 */

import { Request as ExpressRequest } from 'express';
import { PublicUser } from './common-types';

/**
 * GraphQL Context
 * Passed to all resolvers
 */
export interface GraphQLContext {
  /** Authenticated user (if logged in) */
  user?: PublicUser;
  /** Correlation ID for request tracking */
  correlationId: string;
  /** Original Express or Fetch API request */
  req: ExpressRequest | Request;
}

/**
 * GraphQL Pagination Input
 */
export interface PaginationInput {
  page?: number;
  limit?: number;
}

/**
 * GraphQL Connection Edge
 */
export interface Edge<T> {
  node: T;
  cursor: string;
}

/**
 * GraphQL Page Info
 */
export interface PageInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * GraphQL Connection (Relay-style pagination)
 */
export interface Connection<T> {
  edges: Edge<T>[];
  pageInfo: PageInfo;
}

/**
 * GraphQL Subscription Payload
 */
export interface SubscriptionPayload<T> {
  data: T;
  timestamp: string;
}

/**
 * GraphQL Input Types
 */

export interface RegisterInput {
  email: string;
  name: string;
  password: string;
}

export interface UpdateUserInput {
  email?: string;
  name?: string;
  password?: string;
}

export interface SendMessageInput {
  content: string;
  recipientId?: string;
  channelId?: string;
}

/**
 * GraphQL Response Types
 */

export interface AuthResponse {
  user: PublicUser;
  token: string;
  expiresIn: string;
}

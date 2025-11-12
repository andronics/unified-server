/**
 * WebSocket types for real-time communication
 * Layer 1: Foundation
 */

import { WebSocket } from 'ws';

/**
 * WebSocket connection metadata
 */
export interface WebSocketConnection {
  /** Unique connection ID */
  id: string;

  /** WebSocket instance */
  socket: WebSocket;

  /** Authenticated user ID (if authenticated) */
  userId?: string;

  /** Topics subscribed to */
  topics: Set<string>;

  /** When connection was established */
  connectedAt: Date;

  /** Last ping timestamp */
  lastPing?: Date;

  /** Last pong timestamp */
  lastPong?: Date;

  /** Connection metadata */
  metadata: Record<string, any>;
}

/**
 * WebSocket message types (client → server)
 */
export type WebSocketClientMessageType =
  | 'auth'
  | 'subscribe'
  | 'unsubscribe'
  | 'message'
  | 'ping';

/**
 * WebSocket message types (server → client)
 */
export type WebSocketServerMessageType =
  | 'auth_success'
  | 'auth_error'
  | 'subscribed'
  | 'unsubscribed'
  | 'message'
  | 'error'
  | 'pong';

/**
 * Base WebSocket message structure
 */
export interface BaseWebSocketMessage {
  type: string;
  timestamp?: string;
}

/**
 * Authentication message (client → server)
 */
export interface AuthMessage extends BaseWebSocketMessage {
  type: 'auth';
  token: string;
}

/**
 * Subscribe message (client → server)
 */
export interface SubscribeMessage extends BaseWebSocketMessage {
  type: 'subscribe';
  topic: string;
}

/**
 * Unsubscribe message (client → server)
 */
export interface UnsubscribeMessage extends BaseWebSocketMessage {
  type: 'unsubscribe';
  topic: string;
}

/**
 * Client message (client → server)
 */
export interface ClientMessage extends BaseWebSocketMessage {
  type: 'message';
  topic: string;
  data: any;
  metadata?: Record<string, any>;
}

/**
 * Ping message (client → server)
 */
export interface PingMessage extends BaseWebSocketMessage {
  type: 'ping';
}

/**
 * Union type for all client messages
 */
export type WebSocketClientMessage =
  | AuthMessage
  | SubscribeMessage
  | UnsubscribeMessage
  | ClientMessage
  | PingMessage;

/**
 * Authentication success response (server → client)
 */
export interface AuthSuccessMessage extends BaseWebSocketMessage {
  type: 'auth_success';
  userId: string;
}

/**
 * Authentication error response (server → client)
 */
export interface AuthErrorMessage extends BaseWebSocketMessage {
  type: 'auth_error';
  message: string;
  code?: number;
}

/**
 * Subscription confirmed (server → client)
 */
export interface SubscribedMessage extends BaseWebSocketMessage {
  type: 'subscribed';
  topic: string;
}

/**
 * Unsubscription confirmed (server → client)
 */
export interface UnsubscribedMessage extends BaseWebSocketMessage {
  type: 'unsubscribed';
  topic: string;
}

/**
 * Server message (server → client)
 */
export interface ServerMessage extends BaseWebSocketMessage {
  type: 'message';
  topic: string;
  eventType?: string;
  data: any;
  metadata?: Record<string, any>;
}

/**
 * Error message (server → client)
 */
export interface ErrorMessage extends BaseWebSocketMessage {
  type: 'error';
  code: number;
  message: string;
  details?: any;
}

/**
 * Pong message (server → client)
 */
export interface PongMessage extends BaseWebSocketMessage {
  type: 'pong';
}

/**
 * Union type for all server messages
 */
export type WebSocketServerMessage =
  | AuthSuccessMessage
  | AuthErrorMessage
  | SubscribedMessage
  | UnsubscribedMessage
  | ServerMessage
  | ErrorMessage
  | PongMessage;

/**
 * WebSocket server configuration
 */
export interface WebSocketServerConfig {
  /** Port to listen on */
  port: number;

  /** Host to bind to */
  host: string;

  /** Enable WebSocket server */
  enabled: boolean;

  /** Ping interval (milliseconds) */
  pingInterval: number;

  /** Ping timeout (milliseconds) */
  pingTimeout: number;

  /** Max connections per IP */
  maxConnectionsPerIp?: number;

  /** Max message size (bytes) */
  maxMessageSize?: number;
}

/**
 * WebSocket message handler
 */
export type WebSocketMessageHandler<T extends WebSocketClientMessage = WebSocketClientMessage> = (
  connection: WebSocketConnection,
  message: T
) => void | Promise<void>;

/**
 * WebSocket connection event handler
 */
export type WebSocketConnectionHandler = (connection: WebSocketConnection) => void | Promise<void>;

/**
 * WebSocket error handler
 */
export type WebSocketErrorHandler = (
  connection: WebSocketConnection,
  error: Error
) => void | Promise<void>;

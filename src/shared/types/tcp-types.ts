/**
 * TCP Protocol Type Definitions
 * Layer 1: Foundation
 *
 * Type definitions for TCP raw socket protocol implementation.
 * Uses length-prefixed binary framing with JSON payloads.
 */

import { PublicUser } from './common-types';

/**
 * TCP Message Types
 * Single-byte identifier for message routing
 */
export enum TcpMessageType {
  // Authentication
  AUTH = 0x01,
  AUTH_SUCCESS = 0x02,
  AUTH_ERROR = 0x03,

  // Topic Subscriptions
  SUBSCRIBE = 0x10,
  UNSUBSCRIBE = 0x11,
  SUBSCRIBED = 0x12,
  UNSUBSCRIBED = 0x13,

  // Messages
  MESSAGE = 0x20,
  SERVER_MESSAGE = 0x21,

  // Keepalive
  PING = 0x30,
  PONG = 0x31,

  // Errors
  ERROR = 0xff,
}

/**
 * Binary Frame Structure
 * Low-level representation of TCP protocol frame
 */
export interface TcpFrame {
  /** Message type byte */
  type: TcpMessageType;

  /** Payload buffer (JSON string as UTF-8 bytes) */
  payload: Buffer;
}

/**
 * Base TCP Message
 * All protocol messages extend this
 */
export interface TcpMessage {
  /** Message type */
  type: TcpMessageType;

  /** Message payload */
  data: unknown;

  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Authentication Request
 * Client sends JWT token for authentication
 */
export interface TcpAuthMessage extends TcpMessage {
  type: TcpMessageType.AUTH;
  data: {
    token: string;
  };
}

/**
 * Authentication Success Response
 */
export interface TcpAuthSuccessMessage extends TcpMessage {
  type: TcpMessageType.AUTH_SUCCESS;
  data: {
    userId: string;
    message: string;
  };
}

/**
 * Authentication Error Response
 */
export interface TcpAuthErrorMessage extends TcpMessage {
  type: TcpMessageType.AUTH_ERROR;
  data: {
    error: string;
    code: string;
  };
}

/**
 * Subscribe to Topic Request
 */
export interface TcpSubscribeMessage extends TcpMessage {
  type: TcpMessageType.SUBSCRIBE;
  data: {
    topic: string;
  };
}

/**
 * Unsubscribe from Topic Request
 */
export interface TcpUnsubscribeMessage extends TcpMessage {
  type: TcpMessageType.UNSUBSCRIBE;
  data: {
    topic: string;
  };
}

/**
 * Subscription Confirmed Response
 */
export interface TcpSubscribedMessage extends TcpMessage {
  type: TcpMessageType.SUBSCRIBED;
  data: {
    topic: string;
    subscriptionId: string;
  };
}

/**
 * Unsubscription Confirmed Response
 */
export interface TcpUnsubscribedMessage extends TcpMessage {
  type: TcpMessageType.UNSUBSCRIBED;
  data: {
    topic: string;
  };
}

/**
 * Client Message (send to topic)
 */
export interface TcpClientMessage extends TcpMessage {
  type: TcpMessageType.MESSAGE;
  data: {
    topic: string;
    content: unknown;
  };
}

/**
 * Server Message (received from topic)
 */
export interface TcpServerMessage extends TcpMessage {
  type: TcpMessageType.SERVER_MESSAGE;
  data: {
    topic: string;
    content: unknown;
    timestamp?: string;
  };
}

/**
 * Ping Request (keepalive)
 */
export interface TcpPingMessage extends TcpMessage {
  type: TcpMessageType.PING;
  data: {
    timestamp: number;
  };
}

/**
 * Pong Response (keepalive)
 */
export interface TcpPongMessage extends TcpMessage {
  type: TcpMessageType.PONG;
  data: {
    timestamp: number;
  };
}

/**
 * Error Message
 */
export interface TcpErrorMessage extends TcpMessage {
  type: TcpMessageType.ERROR;
  data: {
    error: string;
    code: string;
    details?: unknown;
  };
}

/**
 * Union of all TCP message types
 */
export type AnyTcpMessage =
  | TcpAuthMessage
  | TcpAuthSuccessMessage
  | TcpAuthErrorMessage
  | TcpSubscribeMessage
  | TcpUnsubscribeMessage
  | TcpSubscribedMessage
  | TcpUnsubscribedMessage
  | TcpClientMessage
  | TcpServerMessage
  | TcpPingMessage
  | TcpPongMessage
  | TcpErrorMessage;

/**
 * TCP Connection State
 */
export interface TcpConnection {
  /** Unique connection ID */
  id: string;

  /** TCP socket */
  socket: import('net').Socket;

  /** Connection established timestamp */
  connectedAt: Date;

  /** Last activity timestamp */
  lastActivityAt: Date;

  /** Client IP address */
  remoteAddress: string;

  /** Client port */
  remotePort: number;

  /** User ID (set after authentication) */
  userId?: string;

  /** Authenticated user info */
  user?: PublicUser;

  /** Active topic subscriptions */
  subscriptions: Map<string, string>; // topic → subscriptionId

  /** Connection metadata */
  metadata: {
    userAgent?: string;
    origin?: string;
    [key: string]: unknown;
  };
}

/**
 * TCP Server Configuration
 */
export interface TcpServerConfig {
  /** Enable TCP server */
  enabled: boolean;

  /** Port to listen on */
  port: number;

  /** Host to bind to */
  host: string;

  /** Ping interval (ms) */
  pingInterval: number;

  /** Ping timeout (ms) */
  pingTimeout: number;

  /** Max connections per IP */
  maxConnectionsPerIp: number;

  /** Max frame size (bytes) */
  maxFrameSize: number;

  /** TCP keep-alive interval (ms) */
  keepAliveInterval: number;

  /** Max total connections */
  maxConnections?: number;
}

/**
 * TCP Server Statistics
 */
export interface TcpServerStats {
  /** Total active connections */
  activeConnections: number;

  /** Total connections by IP */
  connectionsByIp: Map<string, number>;

  /** Total authenticated connections */
  authenticatedConnections: number;

  /** Total subscriptions */
  totalSubscriptions: number;

  /** Total messages sent */
  messagesSent: number;

  /** Total messages received */
  messagesReceived: number;

  /** Total errors */
  errors: number;

  /** Server start time */
  startedAt: Date;

  /** Server uptime (ms) */
  uptime: number;
}

/**
 * Frame Parser State
 * Internal state for streaming frame parser
 */
export interface FrameParserState {
  /** Buffered data */
  buffer: Buffer;

  /** Expected frame length (if header parsed) */
  expectedLength?: number;

  /** Frames parsed count */
  framesParsed: number;

  /** Bytes processed */
  bytesProcessed: number;
}

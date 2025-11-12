/**
 * TCP Protocol Codec - Binary Message Encoding/Decoding
 * Layer 4: Application
 *
 * Handles conversion between TcpMessage objects and binary frames.
 * Uses length-prefixed framing with JSON payloads.
 *
 * Frame Format:
 * ┌─────────────┬──────────┬──────────────┐
 * │  Length     │  Type    │   Payload    │
 * │  (4 bytes)  │ (1 byte) │  (JSON/UTF8) │
 * └─────────────┴──────────┴──────────────┘
 */

import { ErrorCode } from '@foundation/errors/error-codes';
import { ApiError } from '@foundation/errors/api-error';
import { TcpMessage, TcpMessageType, AnyTcpMessage, TcpFrame } from '@foundation/types/tcp-types';
import { logger } from '@infrastructure/logging/logger';

/**
 * Protocol Codec Configuration
 */
export interface ProtocolCodecConfig {
  /** Maximum frame size in bytes (default: 1MB) */
  maxFrameSize: number;

  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Protocol Codec
 * Handles binary encoding and decoding of TCP messages
 */
export class ProtocolCodec {
  private readonly maxFrameSize: number;
  private readonly debug: boolean;

  constructor(config: ProtocolCodecConfig) {
    this.maxFrameSize = config.maxFrameSize;
    this.debug = config.debug ?? false;
  }

  /**
   * Encode a TCP message to binary frame
   *
   * @param message - TCP message to encode
   * @returns Binary frame ready to send
   * @throws {ApiError} If message is too large or invalid
   */
  encode(message: AnyTcpMessage): Buffer {
    try {
      // Serialize payload to JSON
      const jsonPayload = JSON.stringify(message.data);
      const payloadBuffer = Buffer.from(jsonPayload, 'utf8');

      // Calculate frame size (type byte + payload)
      const frameSize = 1 + payloadBuffer.length;

      // Check size limit
      if (frameSize > this.maxFrameSize) {
        throw new ApiError(
          `Frame size ${frameSize} exceeds maximum ${this.maxFrameSize}`,
          ErrorCode.TCP_FRAME_TOO_LARGE,
          { frameSize, maxFrameSize: this.maxFrameSize },
          false
        );
      }

      // Allocate buffer: [length: 4 bytes][type: 1 byte][payload: variable]
      const frame = Buffer.allocUnsafe(4 + frameSize);

      // Write length (big-endian uint32)
      frame.writeUInt32BE(frameSize, 0);

      // Write message type
      frame.writeUInt8(message.type, 4);

      // Copy payload
      payloadBuffer.copy(frame, 5);

      if (this.debug) {
        logger.debug(
          {
            messageType: TcpMessageType[message.type],
            frameSize,
            payloadSize: payloadBuffer.length,
          },
          'TCP message encoded'
        );
      }

      return frame;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      logger.error({ error, message }, 'Failed to encode TCP message');
      throw ApiError.internalError('Failed to encode message', {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Decode a binary frame to TCP message
   *
   * @param frame - Binary frame to decode
   * @returns Decoded TCP message
   * @throws {ApiError} If frame is invalid or malformed
   */
  decode(frame: TcpFrame): AnyTcpMessage {
    try {
      // Validate message type
      if (!this.isValidMessageType(frame.type)) {
        throw new ApiError(
          `Invalid message type: ${frame.type}`,
          ErrorCode.TCP_INVALID_MESSAGE_TYPE,
          { type: frame.type },
          false
        );
      }

      // Parse JSON payload
      const jsonString = frame.payload.toString('utf8');
      const data = JSON.parse(jsonString);

      // Create message object
      const message: TcpMessage = {
        type: frame.type,
        data,
      };

      if (this.debug) {
        logger.debug(
          {
            messageType: TcpMessageType[frame.type],
            payloadSize: frame.payload.length,
          },
          'TCP message decoded'
        );
      }

      return message as AnyTcpMessage;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      // Handle JSON parse errors
      if (error instanceof SyntaxError) {
        logger.error({ error, frame }, 'Invalid JSON in TCP frame');
        throw new ApiError(
          'Invalid message format',
          ErrorCode.TCP_INVALID_FRAME,
          { error: error.message },
          false
        );
      }

      logger.error({ error, frame }, 'Failed to decode TCP message');
      throw ApiError.internalError('Failed to decode message', {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Validate message type
   *
   * @param type - Message type byte
   * @returns True if valid message type
   */
  private isValidMessageType(type: number): type is TcpMessageType {
    const validTypes = new Set([
      TcpMessageType.AUTH,
      TcpMessageType.AUTH_SUCCESS,
      TcpMessageType.AUTH_ERROR,
      TcpMessageType.SUBSCRIBE,
      TcpMessageType.UNSUBSCRIBE,
      TcpMessageType.SUBSCRIBED,
      TcpMessageType.UNSUBSCRIBED,
      TcpMessageType.MESSAGE,
      TcpMessageType.SERVER_MESSAGE,
      TcpMessageType.PING,
      TcpMessageType.PONG,
      TcpMessageType.ERROR,
    ]);

    return validTypes.has(type);
  }

  /**
   * Create an error message
   *
   * @param error - Error message
   * @param code - Error code
   * @param details - Optional error details
   * @returns Encoded error message frame
   */
  encodeError(error: string, code: string, details?: unknown): Buffer {
    const errorMessage: AnyTcpMessage = {
      type: TcpMessageType.ERROR,
      data: {
        error,
        code,
        details,
      },
    };

    return this.encode(errorMessage);
  }

  /**
   * Create an authentication success message
   *
   * @param userId - Authenticated user ID
   * @param message - Success message
   * @returns Encoded auth success frame
   */
  encodeAuthSuccess(userId: string, message: string): Buffer {
    const authMessage: AnyTcpMessage = {
      type: TcpMessageType.AUTH_SUCCESS,
      data: {
        userId,
        message,
      },
    };

    return this.encode(authMessage);
  }

  /**
   * Create a subscription confirmed message
   *
   * @param topic - Subscribed topic
   * @param subscriptionId - Subscription ID
   * @returns Encoded subscribed frame
   */
  encodeSubscribed(topic: string, subscriptionId: string): Buffer {
    const subMessage: AnyTcpMessage = {
      type: TcpMessageType.SUBSCRIBED,
      data: {
        topic,
        subscriptionId,
      },
    };

    return this.encode(subMessage);
  }

  /**
   * Create an unsubscription confirmed message
   *
   * @param topic - Unsubscribed topic
   * @returns Encoded unsubscribed frame
   */
  encodeUnsubscribed(topic: string): Buffer {
    const unsubMessage: AnyTcpMessage = {
      type: TcpMessageType.UNSUBSCRIBED,
      data: {
        topic,
      },
    };

    return this.encode(unsubMessage);
  }

  /**
   * Create a server message (forwarded from PubSub)
   *
   * @param topic - Message topic
   * @param content - Message content
   * @param timestamp - Optional timestamp
   * @returns Encoded server message frame
   */
  encodeServerMessage(topic: string, content: unknown, timestamp?: string): Buffer {
    const serverMessage: AnyTcpMessage = {
      type: TcpMessageType.SERVER_MESSAGE,
      data: {
        topic,
        content,
        timestamp: timestamp || new Date().toISOString(),
      },
    };

    return this.encode(serverMessage);
  }

  /**
   * Create a pong response
   *
   * @param timestamp - Client's ping timestamp
   * @returns Encoded pong frame
   */
  encodePong(timestamp: number): Buffer {
    const pongMessage: AnyTcpMessage = {
      type: TcpMessageType.PONG,
      data: {
        timestamp,
      },
    };

    return this.encode(pongMessage);
  }

  /**
   * Get codec statistics
   */
  getStats() {
    return {
      maxFrameSize: this.maxFrameSize,
      debug: this.debug,
    };
  }
}

/**
 * Create a protocol codec instance
 *
 * @param config - Codec configuration
 * @returns Protocol codec instance
 */
export function createProtocolCodec(config: ProtocolCodecConfig): ProtocolCodec {
  return new ProtocolCodec(config);
}

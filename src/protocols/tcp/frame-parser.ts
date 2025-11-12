/**
 * TCP Frame Parser - Stream-based Frame Parsing
 * Layer 4: Application
 *
 * Handles parsing of TCP streams into complete frames.
 * Solves the TCP message boundary problem by using length-prefixed framing.
 *
 * Handles:
 * - Partial frames (incomplete data)
 * - Multiple frames in one chunk
 * - Frames split across multiple chunks
 * - Frame size validation
 */

import { ErrorCode } from '@shared/errors/error-codes';
import { ApiError } from '@shared/errors/api-error';
import { TcpFrame, TcpMessageType, FrameParserState } from '@shared/types/tcp-types';
import { logger } from '@infrastructure/logging/logger';

/**
 * Frame Parser Configuration
 */
export interface FrameParserConfig {
  /** Maximum frame size in bytes */
  maxFrameSize: number;

  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Frame Parser
 * Parses binary TCP stream into complete frames
 */
export class FrameParser {
  private buffer: Buffer;
  private readonly maxFrameSize: number;
  private readonly debug: boolean;

  // Statistics
  private framesParsed: number = 0;
  private bytesProcessed: number = 0;
  private errors: number = 0;

  constructor(config: FrameParserConfig) {
    this.buffer = Buffer.allocUnsafe(0);
    this.maxFrameSize = config.maxFrameSize;
    this.debug = config.debug ?? false;
  }

  /**
   * Feed incoming data chunk to parser
   * Returns array of complete frames
   *
   * @param chunk - Incoming data chunk
   * @returns Array of parsed frames
   * @throws {ApiError} If frame is too large or malformed
   */
  feed(chunk: Buffer): TcpFrame[] {
    // Append chunk to buffer
    this.buffer = Buffer.concat([this.buffer, chunk]);
    this.bytesProcessed += chunk.length;

    const frames: TcpFrame[] = [];

    // Parse as many complete frames as possible
    while (this.buffer.length >= 4) {
      // Read frame length (big-endian uint32)
      const frameSize = this.buffer.readUInt32BE(0);

      // Validate frame size
      if (frameSize > this.maxFrameSize) {
        this.errors++;
        logger.error(
          {
            frameSize,
            maxFrameSize: this.maxFrameSize,
            bufferLength: this.buffer.length,
          },
          'Frame size exceeds maximum'
        );

        // Clear buffer to recover from error
        this.buffer = Buffer.allocUnsafe(0);

        throw new ApiError(
          `Frame size ${frameSize} exceeds maximum ${this.maxFrameSize}`,
          ErrorCode.TCP_FRAME_TOO_LARGE,
          { frameSize, maxFrameSize: this.maxFrameSize },
          false
        );
      }

      // Check if we have complete frame (4 byte length + frame data)
      if (this.buffer.length < 4 + frameSize) {
        // Incomplete frame, wait for more data
        if (this.debug) {
          logger.debug(
            {
              bufferLength: this.buffer.length,
              expectedLength: 4 + frameSize,
              missing: 4 + frameSize - this.buffer.length,
            },
            'Incomplete frame, buffering'
          );
        }
        break;
      }

      // Extract type byte
      const type = this.buffer.readUInt8(4);

      // Validate message type (basic range check)
      if (!this.isValidTypeRange(type)) {
        this.errors++;
        logger.error({ type, typeHex: `0x${type.toString(16)}` }, 'Invalid message type');

        // Skip this frame and try to recover
        this.buffer = this.buffer.slice(4 + frameSize);

        throw new ApiError(
          `Invalid message type: 0x${type.toString(16)}`,
          ErrorCode.TCP_INVALID_MESSAGE_TYPE,
          { type },
          false
        );
      }

      // Extract payload (everything after type byte)
      const payload = this.buffer.slice(5, 4 + frameSize);

      // Create frame
      const frame: TcpFrame = {
        type: type as TcpMessageType,
        payload,
      };

      frames.push(frame);
      this.framesParsed++;

      if (this.debug) {
        logger.debug(
          {
            messageType: TcpMessageType[type] || `UNKNOWN(${type})`,
            frameSize,
            payloadSize: payload.length,
          },
          'Frame parsed'
        );
      }

      // Remove parsed frame from buffer
      this.buffer = this.buffer.slice(4 + frameSize);
    }

    return frames;
  }

  /**
   * Basic validation that type byte is in valid range
   * Detailed validation happens in protocol codec
   *
   * @param type - Message type byte
   * @returns True if in valid range
   */
  private isValidTypeRange(type: number): boolean {
    // Valid ranges:
    // 0x01-0x03: Auth messages
    // 0x10-0x13: Subscription messages
    // 0x20-0x21: Data messages
    // 0x30-0x31: Keepalive messages
    // 0xFF: Error message

    return (
      (type >= 0x01 && type <= 0x03) ||
      (type >= 0x10 && type <= 0x13) ||
      (type >= 0x20 && type <= 0x21) ||
      (type >= 0x30 && type <= 0x31) ||
      type === 0xff
    );
  }

  /**
   * Reset parser state
   * Clears buffer and statistics
   */
  reset(): void {
    this.buffer = Buffer.allocUnsafe(0);
    this.framesParsed = 0;
    this.bytesProcessed = 0;
    this.errors = 0;
  }

  /**
   * Get current parser state
   *
   * @returns Parser state snapshot
   */
  getState(): FrameParserState {
    return {
      buffer: this.buffer,
      expectedLength: this.buffer.length >= 4 ? this.buffer.readUInt32BE(0) : undefined,
      framesParsed: this.framesParsed,
      bytesProcessed: this.bytesProcessed,
    };
  }

  /**
   * Get parser statistics
   */
  getStats() {
    return {
      framesParsed: this.framesParsed,
      bytesProcessed: this.bytesProcessed,
      errors: this.errors,
      bufferSize: this.buffer.length,
      maxFrameSize: this.maxFrameSize,
    };
  }

  /**
   * Check if parser has buffered data
   *
   * @returns True if buffer is not empty
   */
  hasBufferedData(): boolean {
    return this.buffer.length > 0;
  }

  /**
   * Get buffered data size
   *
   * @returns Size of buffered data in bytes
   */
  getBufferedSize(): number {
    return this.buffer.length;
  }
}

/**
 * Create a frame parser instance
 *
 * @param config - Parser configuration
 * @returns Frame parser instance
 */
export function createFrameParser(config: FrameParserConfig): FrameParser {
  return new FrameParser(config);
}

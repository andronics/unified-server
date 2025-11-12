/**
 * Unit tests for TCP Protocol Codec
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ProtocolCodec } from '@protocols/tcp/protocol-codec';
import { TcpMessageType } from '@shared/types/tcp-types';
import { ApiError } from '@shared/errors/api-error';
import { ErrorCode } from '@shared/errors/error-codes';

describe('ProtocolCodec', () => {
  let codec: ProtocolCodec;

  beforeEach(() => {
    codec = new ProtocolCodec({
      maxFrameSize: 1024 * 1024, // 1MB
    });
  });

  describe('Constructor', () => {
    it('should create codec with default config', () => {
      const defaultCodec = new ProtocolCodec({ maxFrameSize: 1048576 });
      expect(defaultCodec).toBeDefined();
    });

    it('should create codec with debug enabled', () => {
      const debugCodec = new ProtocolCodec({
        maxFrameSize: 1048576,
        debug: true,
      });
      expect(debugCodec).toBeDefined();
    });
  });

  describe('encode', () => {
    it('should encode AUTH message', () => {
      const message = {
        type: TcpMessageType.AUTH,
        data: { token: 'test-jwt-token' },
      };

      const frame = codec.encode(message);

      expect(frame).toBeInstanceOf(Buffer);
      expect(frame.length).toBeGreaterThan(5); // At least header + 1 byte payload

      // Check frame structure
      const frameSize = frame.readUInt32BE(0);
      const messageType = frame.readUInt8(4);

      expect(messageType).toBe(TcpMessageType.AUTH);
      expect(frameSize).toBe(frame.length - 4); // Size doesn't include length field
    });

    it('should encode AUTH_SUCCESS message', () => {
      const message = {
        type: TcpMessageType.AUTH_SUCCESS,
        data: {
          userId: '12345',
          message: 'Authentication successful',
        },
      };

      const frame = codec.encode(message);
      const messageType = frame.readUInt8(4);

      expect(messageType).toBe(TcpMessageType.AUTH_SUCCESS);
    });

    it('should encode SUBSCRIBE message', () => {
      const message = {
        type: TcpMessageType.SUBSCRIBE,
        data: { topic: 'notifications' },
      };

      const frame = codec.encode(message);
      const messageType = frame.readUInt8(4);

      expect(messageType).toBe(TcpMessageType.SUBSCRIBE);
    });

    it('should encode UNSUBSCRIBE message', () => {
      const message = {
        type: TcpMessageType.UNSUBSCRIBE,
        data: { topic: 'notifications' },
      };

      const frame = codec.encode(message);
      const messageType = frame.readUInt8(4);

      expect(messageType).toBe(TcpMessageType.UNSUBSCRIBE);
    });

    it('should encode MESSAGE (publish)', () => {
      const message = {
        type: TcpMessageType.MESSAGE,
        data: {
          topic: 'chat',
          content: 'Hello, world!',
        },
      };

      const frame = codec.encode(message);
      const messageType = frame.readUInt8(4);

      expect(messageType).toBe(TcpMessageType.MESSAGE);
    });

    it('should encode SERVER_MESSAGE', () => {
      const message = {
        type: TcpMessageType.SERVER_MESSAGE,
        data: {
          topic: 'notifications',
          content: { alert: 'New message' },
          timestamp: '2025-01-01T00:00:00Z',
        },
      };

      const frame = codec.encode(message);
      const messageType = frame.readUInt8(4);

      expect(messageType).toBe(TcpMessageType.SERVER_MESSAGE);
    });

    it('should encode PING message', () => {
      const message = {
        type: TcpMessageType.PING,
        data: { timestamp: Date.now() },
      };

      const frame = codec.encode(message);
      const messageType = frame.readUInt8(4);

      expect(messageType).toBe(TcpMessageType.PING);
    });

    it('should encode PONG message', () => {
      const message = {
        type: TcpMessageType.PONG,
        data: { timestamp: Date.now() },
      };

      const frame = codec.encode(message);
      const messageType = frame.readUInt8(4);

      expect(messageType).toBe(TcpMessageType.PONG);
    });

    it('should encode ERROR message', () => {
      const message = {
        type: TcpMessageType.ERROR,
        data: {
          error: 'Invalid token',
          code: String(ErrorCode.UNAUTHORIZED),
        },
      };

      const frame = codec.encode(message);
      const messageType = frame.readUInt8(4);

      expect(messageType).toBe(TcpMessageType.ERROR);
    });

    it('should encode message with complex nested data', () => {
      const message = {
        type: TcpMessageType.SERVER_MESSAGE,
        data: {
          topic: 'updates',
          content: {
            user: { id: '123', name: 'Test User' },
            items: [1, 2, 3, 4, 5],
            metadata: { nested: { deep: { value: true } } },
          },
        },
      };

      const frame = codec.encode(message);

      expect(frame).toBeInstanceOf(Buffer);
      expect(frame.length).toBeGreaterThan(5);
    });

    it('should throw error if frame size exceeds maximum', () => {
      const smallCodec = new ProtocolCodec({ maxFrameSize: 100 });

      const message = {
        type: TcpMessageType.MESSAGE,
        data: {
          topic: 'test',
          content: 'x'.repeat(200), // Large payload
        },
      };

      expect(() => smallCodec.encode(message)).toThrow(ApiError);
      expect(() => smallCodec.encode(message)).toThrow('exceeds maximum');
    });

    it('should handle empty data object', () => {
      const message = {
        type: TcpMessageType.PING,
        data: {},
      };

      const frame = codec.encode(message);

      expect(frame).toBeInstanceOf(Buffer);
      expect(frame.length).toBeGreaterThan(5);
    });

    it('should handle unicode characters in data', () => {
      const message = {
        type: TcpMessageType.MESSAGE,
        data: {
          topic: 'chat',
          content: '你好世界 🌍 مرحبا',
        },
      };

      const frame = codec.encode(message);

      expect(frame).toBeInstanceOf(Buffer);
      expect(frame.length).toBeGreaterThan(5);
    });
  });

  describe('decode', () => {
    it('should decode AUTH message', () => {
      const original = {
        type: TcpMessageType.AUTH,
        data: { token: 'test-jwt-token' },
      };

      const frame = codec.encode(original);
      const tcpFrame = {
        type: frame.readUInt8(4) as TcpMessageType,
        payload: frame.slice(5),
      };

      const decoded = codec.decode(tcpFrame);

      expect(decoded.type).toBe(TcpMessageType.AUTH);
      expect(decoded.data).toEqual(original.data);
    });

    it('should decode AUTH_SUCCESS message', () => {
      const original = {
        type: TcpMessageType.AUTH_SUCCESS,
        data: {
          userId: '12345',
          message: 'Success',
        },
      };

      const frame = codec.encode(original);
      const tcpFrame = {
        type: frame.readUInt8(4) as TcpMessageType,
        payload: frame.slice(5),
      };

      const decoded = codec.decode(tcpFrame);

      expect(decoded.type).toBe(TcpMessageType.AUTH_SUCCESS);
      expect(decoded.data).toEqual(original.data);
    });

    it('should decode SUBSCRIBE message', () => {
      const original = {
        type: TcpMessageType.SUBSCRIBE,
        data: { topic: 'notifications' },
      };

      const frame = codec.encode(original);
      const tcpFrame = {
        type: frame.readUInt8(4) as TcpMessageType,
        payload: frame.slice(5),
      };

      const decoded = codec.decode(tcpFrame);

      expect(decoded.type).toBe(TcpMessageType.SUBSCRIBE);
      expect(decoded.data).toEqual(original.data);
    });

    it('should decode complex nested data', () => {
      const original = {
        type: TcpMessageType.SERVER_MESSAGE,
        data: {
          topic: 'updates',
          content: {
            user: { id: '123', name: 'Test User' },
            items: [1, 2, 3, 4, 5],
            metadata: { nested: { deep: { value: true } } },
          },
        },
      };

      const frame = codec.encode(original);
      const tcpFrame = {
        type: frame.readUInt8(4) as TcpMessageType,
        payload: frame.slice(5),
      };

      const decoded = codec.decode(tcpFrame);

      expect(decoded.type).toBe(TcpMessageType.SERVER_MESSAGE);
      expect(decoded.data).toEqual(original.data);
    });

    it('should decode unicode characters', () => {
      const original = {
        type: TcpMessageType.MESSAGE,
        data: {
          topic: 'chat',
          content: '你好世界 🌍 مرحبا',
        },
      };

      const frame = codec.encode(original);
      const tcpFrame = {
        type: frame.readUInt8(4) as TcpMessageType,
        payload: frame.slice(5),
      };

      const decoded = codec.decode(tcpFrame);

      expect(decoded.data).toEqual(original.data);
    });

    it('should throw error on invalid JSON', () => {
      const tcpFrame = {
        type: TcpMessageType.AUTH,
        payload: Buffer.from('invalid json{', 'utf8'),
      };

      expect(() => codec.decode(tcpFrame)).toThrow(ApiError);
    });

    it('should throw error on non-UTF8 payload', () => {
      const tcpFrame = {
        type: TcpMessageType.AUTH,
        payload: Buffer.from([0xff, 0xfe, 0xfd]), // Invalid UTF-8
      };

      expect(() => codec.decode(tcpFrame)).toThrow();
    });
  });

  describe('Round-trip encoding/decoding', () => {
    it('should preserve AUTH message through encode/decode', () => {
      const original = {
        type: TcpMessageType.AUTH,
        data: { token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
      };

      const frame = codec.encode(original);
      const tcpFrame = {
        type: frame.readUInt8(4) as TcpMessageType,
        payload: frame.slice(5),
      };
      const decoded = codec.decode(tcpFrame);

      expect(decoded).toEqual(original);
    });

    it('should preserve SUBSCRIBE message through encode/decode', () => {
      const original = {
        type: TcpMessageType.SUBSCRIBE,
        data: { topic: 'test-topic-123' },
      };

      const frame = codec.encode(original);
      const tcpFrame = {
        type: frame.readUInt8(4) as TcpMessageType,
        payload: frame.slice(5),
      };
      const decoded = codec.decode(tcpFrame);

      expect(decoded).toEqual(original);
    });

    it('should preserve MESSAGE with complex data', () => {
      const original = {
        type: TcpMessageType.MESSAGE,
        data: {
          topic: 'chat',
          content: {
            text: 'Hello!',
            user: { id: '123', name: 'Alice' },
            timestamp: 1234567890,
            metadata: { room: 'general', priority: 'high' },
          },
        },
      };

      const frame = codec.encode(original);
      const tcpFrame = {
        type: frame.readUInt8(4) as TcpMessageType,
        payload: frame.slice(5),
      };
      const decoded = codec.decode(tcpFrame);

      expect(decoded).toEqual(original);
    });

    it('should preserve ERROR message', () => {
      const original = {
        type: TcpMessageType.ERROR,
        data: {
          error: 'Authentication failed',
          code: String(ErrorCode.UNAUTHORIZED),
          details: { reason: 'Invalid token', timestamp: Date.now() },
        },
      };

      const frame = codec.encode(original);
      const tcpFrame = {
        type: frame.readUInt8(4) as TcpMessageType,
        payload: frame.slice(5),
      };
      const decoded = codec.decode(tcpFrame);

      expect(decoded).toEqual(original);
    });

    it('should handle multiple round-trips', () => {
      const original = {
        type: TcpMessageType.PING,
        data: { timestamp: 1234567890 },
      };

      // Encode/decode 5 times
      let current = original;
      for (let i = 0; i < 5; i++) {
        const frame = codec.encode(current);
        const tcpFrame = {
          type: frame.readUInt8(4) as TcpMessageType,
          payload: frame.slice(5),
        };
        current = codec.decode(tcpFrame);
      }

      expect(current).toEqual(original);
    });
  });

  describe('Frame format validation', () => {
    it('should create correct frame header', () => {
      const message = {
        type: TcpMessageType.PING,
        data: { timestamp: 123 },
      };

      const frame = codec.encode(message);

      // Frame format: [4 bytes length][1 byte type][payload]
      expect(frame.length).toBeGreaterThanOrEqual(5);

      const length = frame.readUInt32BE(0);
      const type = frame.readUInt8(4);

      expect(length).toBe(frame.length - 4); // Length excludes length field
      expect(type).toBe(TcpMessageType.PING);
    });

    it('should use big-endian byte order for length', () => {
      const message = {
        type: TcpMessageType.PING,
        data: { timestamp: 123 },
      };

      const frame = codec.encode(message);

      // Manually read as big-endian
      const length =
        (frame[0] << 24) | (frame[1] << 16) | (frame[2] << 8) | frame[3];

      expect(length).toBe(frame.length - 4);
    });

    it('should have payload starting at byte 5', () => {
      const message = {
        type: TcpMessageType.AUTH,
        data: { token: 'test' },
      };

      const frame = codec.encode(message);
      const payloadStart = frame.slice(5);
      const jsonString = payloadStart.toString('utf8');

      expect(() => JSON.parse(jsonString)).not.toThrow();
      const parsed = JSON.parse(jsonString);
      expect(parsed).toEqual(message.data);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string values', () => {
      const message = {
        type: TcpMessageType.MESSAGE,
        data: { topic: '', content: '' },
      };

      const frame = codec.encode(message);
      const tcpFrame = {
        type: frame.readUInt8(4) as TcpMessageType,
        payload: frame.slice(5),
      };
      const decoded = codec.decode(tcpFrame);

      expect(decoded.data).toEqual(message.data);
    });

    it('should handle null values in data', () => {
      const message = {
        type: TcpMessageType.MESSAGE,
        data: { topic: 'test', content: null },
      };

      const frame = codec.encode(message);
      const tcpFrame = {
        type: frame.readUInt8(4) as TcpMessageType,
        payload: frame.slice(5),
      };
      const decoded = codec.decode(tcpFrame);

      expect(decoded.data).toEqual(message.data);
    });

    it('should handle arrays in data', () => {
      const message = {
        type: TcpMessageType.MESSAGE,
        data: {
          topic: 'test',
          content: [1, 2, 3, 'four', { five: 5 }],
        },
      };

      const frame = codec.encode(message);
      const tcpFrame = {
        type: frame.readUInt8(4) as TcpMessageType,
        payload: frame.slice(5),
      };
      const decoded = codec.decode(tcpFrame);

      expect(decoded.data).toEqual(message.data);
    });

    it('should handle boolean values', () => {
      const message = {
        type: TcpMessageType.MESSAGE,
        data: {
          topic: 'test',
          content: { flag: true, disabled: false },
        },
      };

      const frame = codec.encode(message);
      const tcpFrame = {
        type: frame.readUInt8(4) as TcpMessageType,
        payload: frame.slice(5),
      };
      const decoded = codec.decode(tcpFrame);

      expect(decoded.data).toEqual(message.data);
    });

    it('should handle numbers (integers and floats)', () => {
      const message = {
        type: TcpMessageType.MESSAGE,
        data: {
          topic: 'test',
          content: {
            int: 42,
            float: 3.14159,
            negative: -100,
            zero: 0,
          },
        },
      };

      const frame = codec.encode(message);
      const tcpFrame = {
        type: frame.readUInt8(4) as TcpMessageType,
        payload: frame.slice(5),
      };
      const decoded = codec.decode(tcpFrame);

      expect(decoded.data).toEqual(message.data);
    });
  });

  describe('Performance', () => {
    it('should encode 1000 messages quickly', () => {
      const message = {
        type: TcpMessageType.PING,
        data: { timestamp: Date.now() },
      };

      const start = Date.now();

      for (let i = 0; i < 1000; i++) {
        codec.encode(message);
      }

      const elapsed = Date.now() - start;

      // Should complete in under 100ms (usually ~10ms)
      expect(elapsed).toBeLessThan(100);
    });

    it('should decode 1000 messages quickly', () => {
      const message = {
        type: TcpMessageType.PING,
        data: { timestamp: Date.now() },
      };

      const frame = codec.encode(message);
      const tcpFrame = {
        type: frame.readUInt8(4) as TcpMessageType,
        payload: frame.slice(5),
      };

      const start = Date.now();

      for (let i = 0; i < 1000; i++) {
        codec.decode(tcpFrame);
      }

      const elapsed = Date.now() - start;

      // Should complete in under 100ms (usually ~20ms)
      expect(elapsed).toBeLessThan(100);
    });
  });
});

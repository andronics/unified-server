/**
 * Unit tests for TCP Frame Parser
 * Tests stream-based parsing with fragmentation handling
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FrameParser } from '@protocols/tcp/frame-parser';
import { TcpMessageType } from '@shared/types/tcp-types';
import { ApiError } from '@shared/errors/api-error';
import { ErrorCode } from '@shared/errors/error-codes';

describe('FrameParser', () => {
  let parser: FrameParser;

  beforeEach(() => {
    parser = new FrameParser({
      maxFrameSize: 1024 * 1024, // 1MB
    });
  });

  describe('Constructor', () => {
    it('should create parser with default config', () => {
      const defaultParser = new FrameParser({ maxFrameSize: 1048576 });
      expect(defaultParser).toBeDefined();
    });

    it('should create parser with debug enabled', () => {
      const debugParser = new FrameParser({
        maxFrameSize: 1048576,
        debug: true,
      });
      expect(debugParser).toBeDefined();
    });
  });

  describe('feed - Single complete frame', () => {
    it('should parse single complete frame', () => {
      // Create a frame: [length][type][payload]
      const payload = Buffer.from(JSON.stringify({ token: 'test' }), 'utf8');
      const frameSize = 1 + payload.length;
      const frame = Buffer.allocUnsafe(4 + frameSize);
      frame.writeUInt32BE(frameSize, 0);
      frame.writeUInt8(TcpMessageType.AUTH, 4);
      payload.copy(frame, 5);

      const frames = parser.feed(frame);

      expect(frames).toHaveLength(1);
      expect(frames[0].type).toBe(TcpMessageType.AUTH);
      expect(frames[0].payload.toString('utf8')).toBe(JSON.stringify({ token: 'test' }));
    });

    it('should parse PING frame', () => {
      const payload = Buffer.from(JSON.stringify({ timestamp: 12345 }), 'utf8');
      const frameSize = 1 + payload.length;
      const frame = Buffer.allocUnsafe(4 + frameSize);
      frame.writeUInt32BE(frameSize, 0);
      frame.writeUInt8(TcpMessageType.PING, 4);
      payload.copy(frame, 5);

      const frames = parser.feed(frame);

      expect(frames).toHaveLength(1);
      expect(frames[0].type).toBe(TcpMessageType.PING);
    });

    it('should parse SUBSCRIBE frame', () => {
      const payload = Buffer.from(JSON.stringify({ topic: 'test' }), 'utf8');
      const frameSize = 1 + payload.length;
      const frame = Buffer.allocUnsafe(4 + frameSize);
      frame.writeUInt32BE(frameSize, 0);
      frame.writeUInt8(TcpMessageType.SUBSCRIBE, 4);
      payload.copy(frame, 5);

      const frames = parser.feed(frame);

      expect(frames).toHaveLength(1);
      expect(frames[0].type).toBe(TcpMessageType.SUBSCRIBE);
      const data = JSON.parse(frames[0].payload.toString('utf8'));
      expect(data.topic).toBe('test');
    });
  });

  describe('feed - Multiple frames in one chunk', () => {
    it('should parse two frames in single chunk', () => {
      // Frame 1: AUTH
      const payload1 = Buffer.from(JSON.stringify({ token: 'test1' }), 'utf8');
      const frameSize1 = 1 + payload1.length;
      const frame1 = Buffer.allocUnsafe(4 + frameSize1);
      frame1.writeUInt32BE(frameSize1, 0);
      frame1.writeUInt8(TcpMessageType.AUTH, 4);
      payload1.copy(frame1, 5);

      // Frame 2: PING
      const payload2 = Buffer.from(JSON.stringify({ timestamp: 123 }), 'utf8');
      const frameSize2 = 1 + payload2.length;
      const frame2 = Buffer.allocUnsafe(4 + frameSize2);
      frame2.writeUInt32BE(frameSize2, 0);
      frame2.writeUInt8(TcpMessageType.PING, 4);
      payload2.copy(frame2, 5);

      // Combine into single chunk
      const chunk = Buffer.concat([frame1, frame2]);
      const frames = parser.feed(chunk);

      expect(frames).toHaveLength(2);
      expect(frames[0].type).toBe(TcpMessageType.AUTH);
      expect(frames[1].type).toBe(TcpMessageType.PING);
    });

    it('should parse three frames in single chunk', () => {
      const frames: Buffer[] = [];

      // Create 3 different frames
      for (let i = 0; i < 3; i++) {
        const payload = Buffer.from(JSON.stringify({ index: i }), 'utf8');
        const frameSize = 1 + payload.length;
        const frame = Buffer.allocUnsafe(4 + frameSize);
        frame.writeUInt32BE(frameSize, 0);
        frame.writeUInt8(TcpMessageType.MESSAGE, 4);
        payload.copy(frame, 5);
        frames.push(frame);
      }

      const chunk = Buffer.concat(frames);
      const parsedFrames = parser.feed(chunk);

      expect(parsedFrames).toHaveLength(3);
      for (let i = 0; i < 3; i++) {
        expect(parsedFrames[i].type).toBe(TcpMessageType.MESSAGE);
        const data = JSON.parse(parsedFrames[i].payload.toString('utf8'));
        expect(data.index).toBe(i);
      }
    });
  });

  describe('feed - Fragmented frames', () => {
    it('should handle frame split after length field', () => {
      const payload = Buffer.from(JSON.stringify({ token: 'test' }), 'utf8');
      const frameSize = 1 + payload.length;
      const frame = Buffer.allocUnsafe(4 + frameSize);
      frame.writeUInt32BE(frameSize, 0);
      frame.writeUInt8(TcpMessageType.AUTH, 4);
      payload.copy(frame, 5);

      // Split after length field (4 bytes)
      const chunk1 = frame.slice(0, 4);
      const chunk2 = frame.slice(4);

      const frames1 = parser.feed(chunk1);
      expect(frames1).toHaveLength(0); // Incomplete

      const frames2 = parser.feed(chunk2);
      expect(frames2).toHaveLength(1);
      expect(frames2[0].type).toBe(TcpMessageType.AUTH);
    });

    it('should handle frame split in middle of payload', () => {
      const payload = Buffer.from(JSON.stringify({ token: 'test-long-token' }), 'utf8');
      const frameSize = 1 + payload.length;
      const frame = Buffer.allocUnsafe(4 + frameSize);
      frame.writeUInt32BE(frameSize, 0);
      frame.writeUInt8(TcpMessageType.AUTH, 4);
      payload.copy(frame, 5);

      // Split in middle
      const splitPoint = Math.floor(frame.length / 2);
      const chunk1 = frame.slice(0, splitPoint);
      const chunk2 = frame.slice(splitPoint);

      const frames1 = parser.feed(chunk1);
      expect(frames1).toHaveLength(0); // Incomplete

      const frames2 = parser.feed(chunk2);
      expect(frames2).toHaveLength(1);
      expect(frames2[0].type).toBe(TcpMessageType.AUTH);
    });

    it('should handle frame split one byte at a time', () => {
      const payload = Buffer.from(JSON.stringify({ test: 'data' }), 'utf8');
      const frameSize = 1 + payload.length;
      const frame = Buffer.allocUnsafe(4 + frameSize);
      frame.writeUInt32BE(frameSize, 0);
      frame.writeUInt8(TcpMessageType.MESSAGE, 4);
      payload.copy(frame, 5);

      // Feed one byte at a time
      let totalFrames: any[] = [];
      for (let i = 0; i < frame.length; i++) {
        const chunk = frame.slice(i, i + 1);
        const frames = parser.feed(chunk);
        totalFrames = totalFrames.concat(frames);
      }

      expect(totalFrames).toHaveLength(1);
      expect(totalFrames[0].type).toBe(TcpMessageType.MESSAGE);
    });

    it('should handle frame split with second frame starting in same chunk', () => {
      // Frame 1
      const payload1 = Buffer.from(JSON.stringify({ id: 1 }), 'utf8');
      const frameSize1 = 1 + payload1.length;
      const frame1 = Buffer.allocUnsafe(4 + frameSize1);
      frame1.writeUInt32BE(frameSize1, 0);
      frame1.writeUInt8(TcpMessageType.MESSAGE, 4);
      payload1.copy(frame1, 5);

      // Frame 2
      const payload2 = Buffer.from(JSON.stringify({ id: 2 }), 'utf8');
      const frameSize2 = 1 + payload2.length;
      const frame2 = Buffer.allocUnsafe(4 + frameSize2);
      frame2.writeUInt32BE(frameSize2, 0);
      frame2.writeUInt8(TcpMessageType.MESSAGE, 4);
      payload2.copy(frame2, 5);

      const combined = Buffer.concat([frame1, frame2]);

      // Split in middle of frame1
      const splitPoint = Math.floor(frame1.length / 2);
      const chunk1 = combined.slice(0, splitPoint);
      const chunk2 = combined.slice(splitPoint);

      const frames1 = parser.feed(chunk1);
      expect(frames1).toHaveLength(0);

      const frames2 = parser.feed(chunk2);
      expect(frames2).toHaveLength(2);
      expect(frames2[0].type).toBe(TcpMessageType.MESSAGE);
      expect(frames2[1].type).toBe(TcpMessageType.MESSAGE);
    });
  });

  describe('feed - Buffer management', () => {
    it('should handle empty chunks', () => {
      const emptyChunk = Buffer.allocUnsafe(0);
      const frames = parser.feed(emptyChunk);

      expect(frames).toHaveLength(0);
    });

    it('should accumulate partial frames across multiple feeds', () => {
      const payload = Buffer.from(JSON.stringify({ large: 'x'.repeat(100) }), 'utf8');
      const frameSize = 1 + payload.length;
      const frame = Buffer.allocUnsafe(4 + frameSize);
      frame.writeUInt32BE(frameSize, 0);
      frame.writeUInt8(TcpMessageType.MESSAGE, 4);
      payload.copy(frame, 5);

      // Split into 10 chunks
      const chunkSize = Math.ceil(frame.length / 10);
      let allFrames: any[] = [];

      for (let i = 0; i < frame.length; i += chunkSize) {
        const chunk = frame.slice(i, Math.min(i + chunkSize, frame.length));
        const frames = parser.feed(chunk);
        allFrames = allFrames.concat(frames);
      }

      expect(allFrames).toHaveLength(1);
      expect(allFrames[0].type).toBe(TcpMessageType.MESSAGE);
    });

    it('should clear buffer after parsing complete frame', () => {
      const payload = Buffer.from(JSON.stringify({ test: 'data' }), 'utf8');
      const frameSize = 1 + payload.length;
      const frame = Buffer.allocUnsafe(4 + frameSize);
      frame.writeUInt32BE(frameSize, 0);
      frame.writeUInt8(TcpMessageType.PING, 4);
      payload.copy(frame, 5);

      parser.feed(frame);

      // Feed another complete frame - should work independently
      const frames = parser.feed(frame);
      expect(frames).toHaveLength(1);
    });
  });

  describe('Error handling', () => {
    it('should throw error if frame size exceeds maximum', () => {
      // Create frame with size larger than max
      const frame = Buffer.allocUnsafe(8);
      frame.writeUInt32BE(2 * 1024 * 1024, 0); // 2MB (exceeds 1MB max)
      frame.writeUInt8(TcpMessageType.MESSAGE, 4);

      expect(() => parser.feed(frame)).toThrow(ApiError);
      expect(() => parser.feed(frame)).toThrow('exceeds maximum');
    });

    it('should clear buffer after error', () => {
      // Create oversized frame
      const frame = Buffer.allocUnsafe(8);
      frame.writeUInt32BE(2 * 1024 * 1024, 0);
      frame.writeUInt8(TcpMessageType.MESSAGE, 4);

      try {
        parser.feed(frame);
      } catch (e) {
        // Expected error
      }

      // Should be able to parse valid frame after error
      const payload = Buffer.from(JSON.stringify({ test: 'data' }), 'utf8');
      const frameSize = 1 + payload.length;
      const validFrame = Buffer.allocUnsafe(4 + frameSize);
      validFrame.writeUInt32BE(frameSize, 0);
      validFrame.writeUInt8(TcpMessageType.PING, 4);
      payload.copy(validFrame, 5);

      const frames = parser.feed(validFrame);
      expect(frames).toHaveLength(1);
    });

    it('should throw error on invalid message type', () => {
      const payload = Buffer.from(JSON.stringify({ test: 'data' }), 'utf8');
      const frameSize = 1 + payload.length;
      const frame = Buffer.allocUnsafe(4 + frameSize);
      frame.writeUInt32BE(frameSize, 0);
      frame.writeUInt8(0xaa, 4); // Invalid type
      payload.copy(frame, 5);

      // Parser validates type range and throws on invalid types
      expect(() => parser.feed(frame)).toThrow(ApiError);
      expect(() => parser.feed(frame)).toThrow('Invalid message type: 0xaa');
    });
  });

  describe('Statistics', () => {
    it('should track frame count', () => {
      const payload = Buffer.from(JSON.stringify({ test: 'data' }), 'utf8');
      const frameSize = 1 + payload.length;
      const frame = Buffer.allocUnsafe(4 + frameSize);
      frame.writeUInt32BE(frameSize, 0);
      frame.writeUInt8(TcpMessageType.PING, 4);
      payload.copy(frame, 5);

      parser.feed(frame);
      parser.feed(frame);
      parser.feed(frame);

      const stats = parser.getStats();
      expect(stats.framesParsed).toBe(3);
    });

    it('should track bytes processed', () => {
      const payload = Buffer.from(JSON.stringify({ test: 'data' }), 'utf8');
      const frameSize = 1 + payload.length;
      const frame = Buffer.allocUnsafe(4 + frameSize);
      frame.writeUInt32BE(frameSize, 0);
      frame.writeUInt8(TcpMessageType.PING, 4);
      payload.copy(frame, 5);

      parser.feed(frame);

      const stats = parser.getStats();
      expect(stats.bytesProcessed).toBe(frame.length);
    });

    it('should track errors', () => {
      const frame = Buffer.allocUnsafe(8);
      frame.writeUInt32BE(2 * 1024 * 1024, 0); // Oversized

      try {
        parser.feed(frame);
      } catch (e) {
        // Expected
      }

      const stats = parser.getStats();
      expect(stats.errors).toBe(1);
    });

    it('should reset stats', () => {
      const payload = Buffer.from(JSON.stringify({ test: 'data' }), 'utf8');
      const frameSize = 1 + payload.length;
      const frame = Buffer.allocUnsafe(4 + frameSize);
      frame.writeUInt32BE(frameSize, 0);
      frame.writeUInt8(TcpMessageType.PING, 4);
      payload.copy(frame, 5);

      parser.feed(frame);
      parser.reset(); // reset() resets both buffer and stats

      const stats = parser.getStats();
      expect(stats.framesParsed).toBe(0);
      expect(stats.bytesProcessed).toBe(0);
      expect(stats.errors).toBe(0);
    });
  });

  describe('Performance', () => {
    it('should parse 1000 frames quickly', () => {
      const payload = Buffer.from(JSON.stringify({ index: 0 }), 'utf8');
      const frameSize = 1 + payload.length;
      const frame = Buffer.allocUnsafe(4 + frameSize);
      frame.writeUInt32BE(frameSize, 0);
      frame.writeUInt8(TcpMessageType.MESSAGE, 4);
      payload.copy(frame, 5);

      const start = Date.now();

      for (let i = 0; i < 1000; i++) {
        parser.feed(frame);
      }

      const elapsed = Date.now() - start;

      // Should complete in under 50ms (usually ~10ms)
      expect(elapsed).toBeLessThan(50);
    });

    it('should handle large payload efficiently', () => {
      const largeData = 'x'.repeat(100 * 1024); // 100KB
      const payload = Buffer.from(JSON.stringify({ data: largeData }), 'utf8');
      const frameSize = 1 + payload.length;
      const frame = Buffer.allocUnsafe(4 + frameSize);
      frame.writeUInt32BE(frameSize, 0);
      frame.writeUInt8(TcpMessageType.MESSAGE, 4);
      payload.copy(frame, 5);

      const start = Date.now();
      const frames = parser.feed(frame);
      const elapsed = Date.now() - start;

      expect(frames).toHaveLength(1);
      // Should parse 100KB in under 10ms
      expect(elapsed).toBeLessThan(10);
    });
  });

  describe('Edge cases', () => {
    it('should handle minimum size frame (header only)', () => {
      const frame = Buffer.allocUnsafe(5);
      frame.writeUInt32BE(1, 0); // Frame size = 1 (type only)
      frame.writeUInt8(TcpMessageType.PING, 4);

      const frames = parser.feed(frame);
      expect(frames).toHaveLength(1);
      expect(frames[0].payload.length).toBe(0);
    });

    it('should handle frame with only length header available', () => {
      const lengthOnly = Buffer.allocUnsafe(4);
      lengthOnly.writeUInt32BE(100, 0);

      const frames = parser.feed(lengthOnly);
      expect(frames).toHaveLength(0); // Incomplete
    });

    it('should handle frame with length and type only', () => {
      const headerOnly = Buffer.allocUnsafe(5);
      headerOnly.writeUInt32BE(10, 0);
      headerOnly.writeUInt8(TcpMessageType.PING, 4);

      const frames = parser.feed(headerOnly);
      expect(frames).toHaveLength(0); // Incomplete (waiting for payload)
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle typical TCP stream fragmentation', () => {
      // Simulate real TCP stream: multiple frames, random chunk sizes
      const messages = [
        { type: TcpMessageType.AUTH, data: { token: 'jwt-token-here' } },
        { type: TcpMessageType.SUBSCRIBE, data: { topic: 'notifications' } },
        { type: TcpMessageType.MESSAGE, data: { topic: 'chat', content: 'Hello!' } },
        { type: TcpMessageType.PING, data: { timestamp: Date.now() } },
      ];

      // Encode all messages
      const frames: Buffer[] = messages.map((msg) => {
        const payload = Buffer.from(JSON.stringify(msg.data), 'utf8');
        const frameSize = 1 + payload.length;
        const frame = Buffer.allocUnsafe(4 + frameSize);
        frame.writeUInt32BE(frameSize, 0);
        frame.writeUInt8(msg.type, 4);
        payload.copy(frame, 5);
        return frame;
      });

      const stream = Buffer.concat(frames);

      // Simulate random TCP fragmentation
      const chunks: Buffer[] = [];
      let offset = 0;
      while (offset < stream.length) {
        const chunkSize = Math.min(
          Math.floor(Math.random() * 50) + 10, // Random 10-60 bytes
          stream.length - offset
        );
        chunks.push(stream.slice(offset, offset + chunkSize));
        offset += chunkSize;
      }

      // Parse chunked stream
      let parsedFrames: any[] = [];
      for (const chunk of chunks) {
        const frames = parser.feed(chunk);
        parsedFrames = parsedFrames.concat(frames);
      }

      expect(parsedFrames).toHaveLength(4);
      expect(parsedFrames[0].type).toBe(TcpMessageType.AUTH);
      expect(parsedFrames[1].type).toBe(TcpMessageType.SUBSCRIBE);
      expect(parsedFrames[2].type).toBe(TcpMessageType.MESSAGE);
      expect(parsedFrames[3].type).toBe(TcpMessageType.PING);
    });
  });
});

/**
 * Logger Tests
 * Tests Pino logging configuration and helper functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies BEFORE importing logger
vi.mock('pino', () => {
  const mockChildLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(),
  };

  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(() => mockChildLogger),
  };

  const mockPinoFn = Object.assign(vi.fn(() => mockLogger), {
    stdTimeFunctions: {
      isoTime: () => ',"time":"2024-01-01T00:00:00.000Z"',
    },
  });

  return {
    default: mockPinoFn,
  };
});
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-1234'),
}));
vi.mock('@infrastructure/config/config-loader', () => ({
  config: {
    app: {
      name: 'test-server',
      env: 'test',
    },
    logging: {
      level: 'info',
      pretty: false,
    },
  },
}));
vi.mock('os', () => ({
  hostname: () => 'test-hostname',
}));

// Import logger AFTER mocks are set up
import pino from 'pino';
import {
  logger,
  createContextLogger,
  withCorrelationId,
  createRequestLogger,
  logStartup,
  logShutdown,
  logUncaughtException,
  logUnhandledRejection,
} from '../logger';

describe('Logger', () => {
  beforeEach(() => {
    // Clear only the logger instance mocks, not the pino constructor mock
    vi.clearAllMocks();
  });

  describe('Logger instance', () => {
    it('should export a logger instance', () => {
      expect(logger).toBeDefined();
      expect(logger).toHaveProperty('info');
      expect(logger).toHaveProperty('warn');
      expect(logger).toHaveProperty('error');
      expect(logger).toHaveProperty('debug');
      expect(logger).toHaveProperty('fatal');
      expect(logger).toHaveProperty('trace');
      expect(logger).toHaveProperty('child');
    });
  });

  describe('createContextLogger()', () => {
    it('should create child logger with context', () => {
      const context = {
        userId: '123',
        action: 'login',
      };

      const childLogger = createContextLogger(context);

      expect(logger.child).toHaveBeenCalledWith(context);
      expect(childLogger).toBeDefined();
    });

    it('should pass through all context fields', () => {
      const context = {
        requestId: 'req-123',
        userId: 'user-456',
        sessionId: 'session-789',
        method: 'POST',
        url: '/api/users',
      };

      createContextLogger(context);

      expect(logger.child).toHaveBeenCalledWith(context);
    });

    it('should handle empty context', () => {
      createContextLogger({});

      expect(logger.child).toHaveBeenCalledWith({});
    });
  });

  describe('withCorrelationId()', () => {
    it('should create child logger with provided correlation ID', () => {
      const childLogger = withCorrelationId('custom-correlation-id');

      expect(logger.child).toHaveBeenCalledWith({
        correlationId: 'custom-correlation-id',
      });
      expect(childLogger).toBeDefined();
    });

    it('should generate correlation ID when not provided', () => {
      const childLogger = withCorrelationId();

      expect(logger.child).toHaveBeenCalledWith({
        correlationId: 'mock-uuid-1234',
      });
      expect(childLogger).toBeDefined();
    });

    it('should generate correlation ID when undefined', () => {
      const childLogger = withCorrelationId(undefined);

      expect(logger.child).toHaveBeenCalledWith({
        correlationId: 'mock-uuid-1234',
      });
      expect(childLogger).toBeDefined();
    });
  });

  describe('createRequestLogger()', () => {
    it('should create child logger with request context', () => {
      const context = {
        requestId: 'req-123',
        method: 'GET',
        url: '/api/users',
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
      };

      const childLogger = createRequestLogger(context);

      expect(logger.child).toHaveBeenCalledWith(context);
      expect(childLogger).toBeDefined();
    });

    it('should handle optional fields', () => {
      const context = {
        requestId: 'req-123',
        method: 'POST',
        url: '/api/messages',
      };

      createRequestLogger(context);

      expect(logger.child).toHaveBeenCalledWith(context);
    });

    it('should pass through all request fields', () => {
      const context = {
        requestId: 'req-456',
        method: 'PUT',
        url: '/api/users/123',
        ip: '192.168.1.1',
        userAgent: 'curl/7.68.0',
      };

      createRequestLogger(context);

      expect(logger.child).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'req-456',
          method: 'PUT',
          url: '/api/users/123',
          ip: '192.168.1.1',
          userAgent: 'curl/7.68.0',
        })
      );
    });
  });

  describe('logStartup()', () => {
    it('should log startup message with port and environment', () => {
      logStartup(3000);

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 3000,
          env: 'test',
          nodeVersion: process.version,
        }),
        '🚀 test-server server started'
      );
    });

    it('should include node version in startup log', () => {
      logStartup(8080);

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          nodeVersion: process.version,
        }),
        expect.any(String)
      );
    });

    it('should use server name from config', () => {
      logStartup(4000);

      expect(logger.info).toHaveBeenCalledWith(expect.any(Object), expect.stringContaining('test-server'));
    });

    it('should include rocket emoji in message', () => {
      logStartup(3000);

      expect(logger.info).toHaveBeenCalledWith(expect.any(Object), expect.stringContaining('🚀'));
    });
  });

  describe('logShutdown()', () => {
    it('should log shutdown message with reason', () => {
      logShutdown('SIGTERM received');

      expect(logger.info).toHaveBeenCalledWith({ reason: 'SIGTERM received' }, '👋 Server shutting down');
    });

    it('should include wave emoji in message', () => {
      logShutdown('User requested');

      expect(logger.info).toHaveBeenCalledWith(expect.any(Object), expect.stringContaining('👋'));
    });

    it('should handle different shutdown reasons', () => {
      logShutdown('Graceful shutdown');

      expect(logger.info).toHaveBeenCalledWith(
        { reason: 'Graceful shutdown' },
        expect.any(String)
      );
    });
  });

  describe('logUncaughtException()', () => {
    it('should log fatal error with exception details', () => {
      const error = new Error('Test exception');
      error.stack = 'Error: Test exception\n    at test.js:10:5';

      logUncaughtException(error);

      expect(logger.fatal).toHaveBeenCalledWith(
        {
          error: {
            message: 'Test exception',
            stack: 'Error: Test exception\n    at test.js:10:5',
            name: 'Error',
          },
        },
        '💥 Uncaught exception'
      );
    });

    it('should include error name', () => {
      const error = new TypeError('Type error occurred');
      error.stack = 'TypeError: Type error occurred\n    at test.js:20:10';

      logUncaughtException(error);

      expect(logger.fatal).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            name: 'TypeError',
          }),
        }),
        expect.any(String)
      );
    });

    it('should include error stack trace', () => {
      const error = new Error('Stack trace test');
      error.stack = 'Error: Stack trace test\n    at Object.<anonymous> (test.js:5:13)';

      logUncaughtException(error);

      expect(logger.fatal).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            stack: 'Error: Stack trace test\n    at Object.<anonymous> (test.js:5:13)',
          }),
        }),
        expect.any(String)
      );
    });

    it('should include explosion emoji in message', () => {
      const error = new Error('Test');

      logUncaughtException(error);

      expect(logger.fatal).toHaveBeenCalledWith(expect.any(Object), expect.stringContaining('💥'));
    });
  });

  describe('logUnhandledRejection()', () => {
    it('should log fatal error with Error rejection details', () => {
      const error = new Error('Promise rejection');
      error.stack = 'Error: Promise rejection\n    at async-test.js:15:8';

      logUnhandledRejection(error);

      expect(logger.fatal).toHaveBeenCalledWith(
        {
          reason: {
            message: 'Promise rejection',
            stack: 'Error: Promise rejection\n    at async-test.js:15:8',
            name: 'Error',
          },
        },
        '💥 Unhandled promise rejection'
      );
    });

    it('should handle non-Error rejection reasons', () => {
      const reason = 'String rejection reason';

      logUnhandledRejection(reason);

      expect(logger.fatal).toHaveBeenCalledWith(
        {
          reason: 'String rejection reason',
        },
        '💥 Unhandled promise rejection'
      );
    });

    it('should handle object rejection reasons', () => {
      const reason = { code: 'ERR_UNKNOWN', message: 'Unknown error' };

      logUnhandledRejection(reason);

      expect(logger.fatal).toHaveBeenCalledWith(
        {
          reason: { code: 'ERR_UNKNOWN', message: 'Unknown error' },
        },
        expect.any(String)
      );
    });

    it('should handle null rejection reasons', () => {
      logUnhandledRejection(null);

      expect(logger.fatal).toHaveBeenCalledWith(
        {
          reason: null,
        },
        expect.any(String)
      );
    });

    it('should include explosion emoji in message', () => {
      logUnhandledRejection(new Error('Test'));

      expect(logger.fatal).toHaveBeenCalledWith(expect.any(Object), expect.stringContaining('💥'));
    });
  });

  describe('Logger methods', () => {
    it('should expose standard Pino logging methods', () => {
      expect(logger.info).toBeInstanceOf(Function);
      expect(logger.warn).toBeInstanceOf(Function);
      expect(logger.error).toBeInstanceOf(Function);
      expect(logger.debug).toBeInstanceOf(Function);
      expect(logger.fatal).toBeInstanceOf(Function);
      expect(logger.trace).toBeInstanceOf(Function);
    });

    it('should expose child method', () => {
      expect(logger.child).toBeInstanceOf(Function);
    });
  });
});

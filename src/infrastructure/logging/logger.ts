/**
 * Logging service with structured logging
 * Layer 2: Infrastructure
 */

import pino from 'pino';
import { config } from '../config/config-loader';
import { v4 as uuidv4 } from 'uuid';

/**
 * Logger instance
 */
export const logger = pino({
  level: config.logging.level,
  transport: config.logging.pretty
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  base: {
    pid: process.pid,
    hostname: require('os').hostname(),
    env: config.app.env,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
});

/**
 * Create a child logger with context
 */
export function createContextLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

/**
 * Generate and attach correlation ID to logger
 */
export function withCorrelationId(correlationId?: string) {
  return logger.child({
    correlationId: correlationId || uuidv4(),
  });
}

/**
 * Logger middleware context
 */
export interface LoggerContext {
  requestId: string;
  method: string;
  url: string;
  ip?: string;
  userAgent?: string;
}

/**
 * Create request logger with context
 */
export function createRequestLogger(context: LoggerContext) {
  return logger.child(context);
}

/**
 * Log application startup
 */
export function logStartup(port: number) {
  logger.info(
    {
      port,
      env: config.app.env,
      nodeVersion: process.version,
    },
    `🚀 ${config.app.name} server started`
  );
}

/**
 * Log application shutdown
 */
export function logShutdown(reason: string) {
  logger.info({ reason }, '👋 Server shutting down');
}

/**
 * Log uncaught exception
 */
export function logUncaughtException(error: Error) {
  logger.fatal(
    {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
    },
    '💥 Uncaught exception'
  );
}

/**
 * Log unhandled rejection
 */
export function logUnhandledRejection(reason: unknown) {
  logger.fatal(
    {
      reason:
        reason instanceof Error
          ? {
              message: reason.message,
              stack: reason.stack,
              name: reason.name,
            }
          : reason,
    },
    '💥 Unhandled promise rejection'
  );
}

export default logger;

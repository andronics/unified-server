/**
 * Configuration schema validation
 * Layer 2: Infrastructure
 */

import { z } from 'zod';

/**
 * Configuration schema with validation and defaults
 */
export const ConfigSchema = z.object({
  app: z.object({
    name: z.string().default('unified-server'),
    env: z.enum(['development', 'staging', 'production', 'test']).default('development'),
    port: z.number().int().min(1).max(65535).default(3000),
    host: z.string().default('0.0.0.0'),
    shutdownTimeout: z.number().int().min(0).default(30000),
  }),

  database: z.object({
    host: z.string(),
    port: z.number().int().min(1).max(65535).default(5432),
    name: z.string(),
    user: z.string(),
    password: z.string(),
    poolMin: z.number().int().min(0).default(2),
    poolMax: z.number().int().min(1).default(20),
  }),

  redis: z.object({
    host: z.string().default('localhost'),
    port: z.number().int().min(1).max(65535).default(6379),
    password: z.string().optional(),
    db: z.number().int().min(0).max(15).default(0),
  }),

  cache: z.object({
    ttl: z.number().int().min(0).default(300), // 5 minutes
  }),

  auth: z.object({
    jwtSecret: z.string().min(32, 'JWT secret must be at least 32 characters'),
    jwtExpiresIn: z.string().default('15m'),
    jwtRefreshExpiresIn: z.string().default('7d'),
  }),

  logging: z.object({
    level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
    pretty: z.boolean().default(false),
  }),

  metrics: z.object({
    enabled: z.boolean().default(true),
    port: z.number().int().min(1).max(65535).default(9090),
  }),

  rateLimit: z.object({
    windowMs: z.number().int().min(0).default(900000), // 15 minutes
    max: z.number().int().min(1).default(100),
  }),

  cors: z.object({
    origins: z.array(z.string()).default(['*']),
  }),

  security: z.object({
    helmetEnabled: z.boolean().default(true),
    compressionEnabled: z.boolean().default(true),
  }),

  websocket: z.object({
    enabled: z.boolean().default(true),
    port: z.number().int().min(1).max(65535).default(3000),
    host: z.string().default('0.0.0.0'),
    pingInterval: z.number().int().min(1000).default(30000), // 30 seconds
    pingTimeout: z.number().int().min(1000).default(60000), // 60 seconds
    maxConnectionsPerIp: z.number().int().min(1).default(100),
    maxMessageSize: z.number().int().min(1024).default(1048576), // 1MB
  }),

  graphql: z.object({
    enabled: z.boolean().default(true),
    path: z.string().default('/graphql'),
    playground: z.object({
      enabled: z.boolean().default(true),
    }),
    complexity: z.object({
      maxDepth: z.number().int().min(1).default(5),
      maxComplexity: z.number().int().min(1).default(1000),
    }),
    introspection: z.boolean().default(true),
  }).optional(),

  tcp: z.object({
    enabled: z.boolean().default(true),
    port: z.number().int().min(1).max(65535).default(3001),
    host: z.string().default('0.0.0.0'),
    pingInterval: z.number().int().min(1000).default(30000), // 30 seconds
    pingTimeout: z.number().int().min(1000).default(60000), // 60 seconds
    maxConnectionsPerIp: z.number().int().min(1).default(100),
    maxFrameSize: z.number().int().min(1024).default(1048576), // 1MB
    keepAliveInterval: z.number().int().min(1000).default(30000), // 30 seconds
    maxConnections: z.number().int().min(1).optional(), // Optional total limit
  }).optional(),
});

export type ValidatedConfig = z.infer<typeof ConfigSchema>;

/**
 * Configuration type definitions
 * Layer 1: Foundation
 */

/**
 * Application configuration
 */
export interface AppConfig {
  app: {
    name: string;
    env: 'development' | 'staging' | 'production' | 'test';
    port: number;
    host: string;
    shutdownTimeout: number;
  };

  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    poolMin: number;
    poolMax: number;
  };

  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };

  cache: {
    ttl: number;
  };

  auth: {
    jwtSecret: string;
    jwtExpiresIn: string;
    jwtRefreshExpiresIn: string;
  };

  logging: {
    level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
    pretty: boolean;
  };

  metrics: {
    enabled: boolean;
    port: number;
  };

  rateLimit: {
    windowMs: number;
    max: number;
  };

  cors: {
    origins: string[];
  };

  security: {
    helmetEnabled: boolean;
    compressionEnabled: boolean;
  };

  websocket: {
    enabled: boolean;
    port: number;
    host: string;
    pingInterval: number;
    pingTimeout: number;
    maxConnectionsPerIp: number;
    maxMessageSize: number;
  };

  graphql?: {
    enabled: boolean;
    path: string;
    playground: {
      enabled: boolean;
    };
    complexity: {
      maxDepth: number;
      maxComplexity: number;
    };
    introspection: boolean;
  };
}

/**
 * Environment variables mapping
 */
export interface EnvVars {
  // Application
  NODE_ENV?: string;
  APP_NAME?: string;
  PORT?: string;
  HOST?: string;
  SHUTDOWN_TIMEOUT?: string;

  // Database
  DB_HOST?: string;
  DB_PORT?: string;
  DB_NAME?: string;
  DB_USER?: string;
  DB_PASSWORD?: string;
  DB_POOL_MIN?: string;
  DB_POOL_MAX?: string;

  // Redis
  REDIS_HOST?: string;
  REDIS_PORT?: string;
  REDIS_PASSWORD?: string;
  REDIS_DB?: string;
  CACHE_TTL?: string;

  // Authentication
  JWT_SECRET?: string;
  JWT_EXPIRES_IN?: string;
  JWT_REFRESH_EXPIRES_IN?: string;

  // Logging
  LOG_LEVEL?: string;
  LOG_PRETTY?: string;

  // Metrics
  METRICS_ENABLED?: string;
  METRICS_PORT?: string;

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS?: string;
  RATE_LIMIT_MAX?: string;

  // CORS
  CORS_ORIGINS?: string;

  // Security
  HELMET_ENABLED?: string;
  COMPRESSION_ENABLED?: string;
}

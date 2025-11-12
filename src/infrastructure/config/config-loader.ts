/**
 * Configuration loader with hierarchical overrides
 * Layer 2: Infrastructure
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { ConfigSchema, ValidatedConfig } from './config-schema';
import { AppConfig } from '@foundation/types/config-types';

/**
 * Configuration loader class
 */
export class ConfigLoader {
  /**
   * Load configuration from all sources
   * Precedence (lowest to highest):
   * 1. Schema defaults
   * 2. config/default.json
   * 3. config/{env}.json
   * 4. Environment variables
   */
  static load(): ValidatedConfig {
    // Load environment variables from .env file
    dotenv.config();

    // 1. Start with empty config (schema will provide defaults)
    let config: Partial<AppConfig> = {};

    // 2. Load config/default.json if it exists
    const defaultConfigPath = path.join(process.cwd(), 'config', 'default.json');
    if (fs.existsSync(defaultConfigPath)) {
      try {
        const defaultConfig = JSON.parse(fs.readFileSync(defaultConfigPath, 'utf-8'));
        config = this.deepMerge(config, defaultConfig);
      } catch (error) {
        console.warn('Failed to load default.json:', error);
      }
    }

    // 3. Load environment-specific config
    const env = process.env.NODE_ENV || 'development';
    const envConfigPath = path.join(process.cwd(), 'config', `${env}.json`);
    if (fs.existsSync(envConfigPath)) {
      try {
        const envConfig = JSON.parse(fs.readFileSync(envConfigPath, 'utf-8'));
        config = this.deepMerge(config, envConfig);
      } catch (error) {
        console.warn(`Failed to load ${env}.json:`, error);
      }
    }

    // 4. Override with environment variables
    config = this.applyEnvOverrides(config);

    // 5. Validate configuration
    const result = ConfigSchema.safeParse(config);
    if (!result.success) {
      console.error('❌ Configuration validation failed:');
      result.error.errors.forEach((err) => {
        console.error(`  ${err.path.join('.')}: ${err.message}`);
      });
      throw new Error('Invalid configuration');
    }

    console.log(`✓ Configuration loaded successfully (${env} environment)`);
    return result.data;
  }

  /**
   * Apply environment variable overrides
   */
  private static applyEnvOverrides(config: Partial<AppConfig>): Partial<AppConfig> {
    return {
      ...config,
      app: {
        ...config.app,
        name: process.env.APP_NAME || config.app?.name || 'unified-server',
        env:
          (process.env.NODE_ENV as 'development' | 'staging' | 'production' | 'test') ||
          config.app?.env ||
          'development',
        port: this.envInt('PORT', config.app?.port || 3000),
        host: process.env.HOST || config.app?.host || '0.0.0.0',
        shutdownTimeout: this.envInt('SHUTDOWN_TIMEOUT', config.app?.shutdownTimeout || 30000),
      },
      database: {
        ...config.database,
        host: process.env.DB_HOST || config.database?.host || 'localhost',
        port: this.envInt('DB_PORT', config.database?.port || 5432),
        name: process.env.DB_NAME || config.database?.name || 'unified_server',
        user: process.env.DB_USER || config.database?.user || 'postgres',
        password: process.env.DB_PASSWORD || config.database?.password || 'postgres',
        poolMin: this.envInt('DB_POOL_MIN', config.database?.poolMin || 2),
        poolMax: this.envInt('DB_POOL_MAX', config.database?.poolMax || 20),
      },
      redis: {
        ...config.redis,
        host: process.env.REDIS_HOST || config.redis?.host || 'localhost',
        port: this.envInt('REDIS_PORT', config.redis?.port || 6379),
        password: process.env.REDIS_PASSWORD || config.redis?.password,
        db: this.envInt('REDIS_DB', config.redis?.db || 0),
      },
      cache: {
        ...config.cache,
        ttl: this.envInt('CACHE_TTL', config.cache?.ttl || 300),
      },
      auth: {
        ...config.auth,
        jwtSecret: process.env.JWT_SECRET || config.auth?.jwtSecret || '',
        jwtExpiresIn: process.env.JWT_EXPIRES_IN || config.auth?.jwtExpiresIn || '15m',
        jwtRefreshExpiresIn:
          process.env.JWT_REFRESH_EXPIRES_IN || config.auth?.jwtRefreshExpiresIn || '7d',
      },
      logging: {
        ...config.logging,
        level:
          (process.env.LOG_LEVEL as 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal') ||
          config.logging?.level ||
          'info',
        pretty: this.envBool('LOG_PRETTY', config.logging?.pretty || false),
      },
      metrics: {
        ...config.metrics,
        enabled: this.envBool('METRICS_ENABLED', config.metrics?.enabled !== false),
        port: this.envInt('METRICS_PORT', config.metrics?.port || 9090),
      },
      rateLimit: {
        ...config.rateLimit,
        windowMs: this.envInt('RATE_LIMIT_WINDOW_MS', config.rateLimit?.windowMs || 900000),
        max: this.envInt('RATE_LIMIT_MAX', config.rateLimit?.max || 100),
      },
      cors: {
        ...config.cors,
        origins: process.env.CORS_ORIGINS
          ? process.env.CORS_ORIGINS.split(',')
          : config.cors?.origins || ['*'],
      },
      security: {
        ...config.security,
        helmetEnabled: this.envBool('HELMET_ENABLED', config.security?.helmetEnabled !== false),
        compressionEnabled: this.envBool(
          'COMPRESSION_ENABLED',
          config.security?.compressionEnabled !== false
        ),
      },
      websocket: {
        ...config.websocket,
        enabled: this.envBool('WEBSOCKET_ENABLED', config.websocket?.enabled !== false),
        port: this.envInt('WEBSOCKET_PORT', config.websocket?.port || 3000),
        host: process.env.WEBSOCKET_HOST || config.websocket?.host || '0.0.0.0',
        pingInterval: this.envInt('WEBSOCKET_PING_INTERVAL', config.websocket?.pingInterval || 30000),
        pingTimeout: this.envInt('WEBSOCKET_PING_TIMEOUT', config.websocket?.pingTimeout || 60000),
        maxConnectionsPerIp: this.envInt(
          'WEBSOCKET_MAX_CONNECTIONS_PER_IP',
          config.websocket?.maxConnectionsPerIp || 100
        ),
        maxMessageSize: this.envInt(
          'WEBSOCKET_MAX_MESSAGE_SIZE',
          config.websocket?.maxMessageSize || 1048576
        ),
      },
      graphql: {
        ...config.graphql,
        enabled: this.envBool('GRAPHQL_ENABLED', config.graphql?.enabled !== false),
        path: process.env.GRAPHQL_PATH || config.graphql?.path || '/graphql',
        playground: {
          enabled: this.envBool('GRAPHQL_PLAYGROUND_ENABLED', config.graphql?.playground?.enabled !== false),
        },
        complexity: {
          maxDepth: this.envInt('GRAPHQL_MAX_DEPTH', config.graphql?.complexity?.maxDepth || 5),
          maxComplexity: this.envInt('GRAPHQL_MAX_COMPLEXITY', config.graphql?.complexity?.maxComplexity || 1000),
        },
        introspection: this.envBool('GRAPHQL_INTROSPECTION_ENABLED', config.graphql?.introspection !== false),
      },
      tcp: {
        enabled: this.envBool('TCP_ENABLED', config.tcp?.enabled !== false),
        port: this.envInt('TCP_PORT', config.tcp?.port || 3001),
        host: process.env.TCP_HOST || config.tcp?.host || '0.0.0.0',
        pingInterval: this.envInt('TCP_PING_INTERVAL', config.tcp?.pingInterval || 30000),
        pingTimeout: this.envInt('TCP_PING_TIMEOUT', config.tcp?.pingTimeout || 60000),
        maxConnectionsPerIp: this.envInt('TCP_MAX_CONNECTIONS_PER_IP', config.tcp?.maxConnectionsPerIp || 100),
        maxFrameSize: this.envInt('TCP_MAX_FRAME_SIZE', config.tcp?.maxFrameSize || 1048576),
        keepAliveInterval: this.envInt('TCP_KEEP_ALIVE_INTERVAL', config.tcp?.keepAliveInterval || 30000),
        maxConnections: config.tcp?.maxConnections ? this.envInt('TCP_MAX_CONNECTIONS', config.tcp.maxConnections) : undefined,
      },
    } as Partial<AppConfig>;
  }

  /**
   * Parse boolean environment variable
   */
  private static envBool(key: string, defaultValue: boolean): boolean {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    return value === 'true' || value === '1';
  }

  /**
   * Parse integer environment variable
   */
  private static envInt(key: string, defaultValue: number): number {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * Deep merge two objects
   */
  private static deepMerge(target: any, source: any): any {
    const result = { ...target };
    for (const key in source) {
      if (source[key] instanceof Object && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }
}

// Lazy-loaded singleton config instance
let _config: ValidatedConfig | null = null;

/**
 * Get the configuration (lazy-loaded)
 * Allows tests to set environment variables before config is loaded
 */
export function getConfig(): ValidatedConfig {
  if (!_config) {
    _config = ConfigLoader.load();
  }
  return _config;
}

/**
 * Reset configuration (for testing)
 */
export function resetConfig(): void {
  _config = null;
}

// Export as const for backwards compatibility
// This will be lazy-loaded on first access
export const config = new Proxy({} as ValidatedConfig, {
  get(_target, prop) {
    return getConfig()[prop as keyof ValidatedConfig];
  },
});

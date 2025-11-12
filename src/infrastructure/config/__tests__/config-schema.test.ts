/**
 * Configuration Schema Tests
 * Tests Zod schema validation, defaults, and type constraints
 */

import { describe, it, expect } from 'vitest';
import { ConfigSchema } from '../config-schema';

describe('ConfigSchema', () => {
  // Helper to create minimal valid config
  const minimalValidConfig = () => ({
    app: {
      name: 'test-app',
      env: 'development' as const,
      port: 3000,
      host: '0.0.0.0',
      shutdownTimeout: 30000,
    },
    database: {
      host: 'localhost',
      port: 5432,
      name: 'test_db',
      user: 'test_user',
      password: 'test_password',
      poolMin: 2,
      poolMax: 20,
    },
    redis: {
      host: 'localhost',
      port: 6379,
      db: 0,
    },
    cache: {
      ttl: 300,
    },
    auth: {
      jwtSecret: 'test-secret-key-that-is-at-least-32-characters-long',
      jwtExpiresIn: '15m',
      jwtRefreshExpiresIn: '7d',
    },
    logging: {
      level: 'info' as const,
      pretty: false,
    },
    metrics: {
      enabled: true,
      port: 9090,
    },
    rateLimit: {
      windowMs: 900000,
      max: 100,
    },
    cors: {
      origins: ['*'],
    },
    security: {
      helmetEnabled: true,
      compressionEnabled: true,
    },
    websocket: {
      enabled: true,
      port: 3000,
      host: '0.0.0.0',
      pingInterval: 30000,
      pingTimeout: 60000,
      maxConnectionsPerIp: 100,
      maxMessageSize: 1048576,
    },
  });

  describe('Full schema validation', () => {
    it('should validate a complete valid configuration', () => {
      const config = minimalValidConfig();
      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.app.name).toBe('test-app');
        expect(result.data.database.host).toBe('localhost');
      }
    });

    it('should validate config with all required fields present', () => {
      const config = minimalValidConfig();

      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.app.name).toBe('test-app');
        expect(result.data.app.env).toBe('development');
        expect(result.data.app.port).toBe(3000);
        expect(result.data.redis.host).toBe('localhost');
        expect(result.data.redis.port).toBe(6379);
        expect(result.data.cache.ttl).toBe(300);
        expect(result.data.metrics.enabled).toBe(true);
      }
    });
  });

  describe('app section', () => {
    it('should validate app configuration', () => {
      const config = minimalValidConfig();
      config.app = {
        name: 'custom-app',
        env: 'production' as const,
        port: 8080,
        host: '127.0.0.1',
        shutdownTimeout: 60000,
      };

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should have default app values in minimalValidConfig', () => {
      const config = minimalValidConfig();

      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.app.name).toBe('test-app');
        expect(result.data.app.env).toBe('development');
        expect(result.data.app.port).toBe(3000);
        expect(result.data.app.host).toBe('0.0.0.0');
        expect(result.data.app.shutdownTimeout).toBe(30000);
      }
    });

    it('should reject invalid environment enum', () => {
      const config = minimalValidConfig();
      (config.app as any).env = 'invalid-env';

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject port outside valid range (too low)', () => {
      const config = minimalValidConfig();
      config.app.port = 0;

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject port outside valid range (too high)', () => {
      const config = minimalValidConfig();
      config.app.port = 65536;

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject negative shutdownTimeout', () => {
      const config = minimalValidConfig();
      config.app.shutdownTimeout = -1;

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('database section', () => {
    it('should validate database configuration', () => {
      const config = minimalValidConfig();
      config.database = {
        host: 'db.example.com',
        port: 5433,
        name: 'production_db',
        user: 'prod_user',
        password: 'secure_password',
        poolMin: 5,
        poolMax: 50,
      };

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should require database host', () => {
      const config = minimalValidConfig();
      delete (config.database as any).host;

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should require database name', () => {
      const config = minimalValidConfig();
      delete (config.database as any).name;

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should require database user', () => {
      const config = minimalValidConfig();
      delete (config.database as any).user;

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should require database password', () => {
      const config = minimalValidConfig();
      delete (config.database as any).password;

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should have default database values in minimalValidConfig', () => {
      const config = minimalValidConfig();

      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.database.port).toBe(5432);
        expect(result.data.database.poolMin).toBe(2);
        expect(result.data.database.poolMax).toBe(20);
      }
    });

    it('should reject poolMax less than 1', () => {
      const config = minimalValidConfig();
      config.database.poolMax = 0;

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject negative poolMin', () => {
      const config = minimalValidConfig();
      config.database.poolMin = -1;

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('redis section', () => {
    it('should validate redis configuration', () => {
      const config = minimalValidConfig();
      (config as any).redis = {
        host: 'redis.example.com',
        port: 6380,
        password: 'redis-password',
        db: 5,
      };

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should allow optional password', () => {
      const config = minimalValidConfig();
      // Password is optional, so this is fine

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should have default redis values in minimalValidConfig', () => {
      const config = minimalValidConfig();

      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.redis.host).toBe('localhost');
        expect(result.data.redis.port).toBe(6379);
        expect(result.data.redis.db).toBe(0);
      }
    });

    it('should reject redis db outside valid range (too low)', () => {
      const config = minimalValidConfig();
      config.redis.db = -1;

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject redis db outside valid range (too high)', () => {
      const config = minimalValidConfig();
      config.redis.db = 16;

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('cache section', () => {
    it('should validate cache configuration', () => {
      const config = minimalValidConfig();
      config.cache = {
        ttl: 600,
      };

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should have default cache TTL in minimalValidConfig', () => {
      const config = minimalValidConfig();

      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cache.ttl).toBe(300);
      }
    });

    it('should reject negative TTL', () => {
      const config = minimalValidConfig();
      config.cache.ttl = -1;

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('auth section', () => {
    it('should validate auth configuration', () => {
      const config = minimalValidConfig();
      config.auth = {
        jwtSecret: 'very-secure-secret-key-that-is-at-least-32-characters-long',
        jwtExpiresIn: '30m',
        jwtRefreshExpiresIn: '14d',
      };

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should require JWT secret', () => {
      const config = minimalValidConfig();
      delete (config.auth as any).jwtSecret;

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject JWT secret shorter than 32 characters', () => {
      const config = minimalValidConfig();
      config.auth.jwtSecret = 'too-short-secret';

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should accept JWT secret exactly 32 characters', () => {
      const config = minimalValidConfig();
      config.auth.jwtSecret = '12345678901234567890123456789012'; // Exactly 32

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should have default JWT expiration values in minimalValidConfig', () => {
      const config = minimalValidConfig();

      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.auth.jwtExpiresIn).toBe('15m');
        expect(result.data.auth.jwtRefreshExpiresIn).toBe('7d');
      }
    });
  });

  describe('logging section', () => {
    it('should validate logging configuration', () => {
      const config = minimalValidConfig();
      config.logging = {
        level: 'debug' as const,
        pretty: true,
      };

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should have default logging values in minimalValidConfig', () => {
      const config = minimalValidConfig();

      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.logging.level).toBe('info');
        expect(result.data.logging.pretty).toBe(false);
      }
    });

    it('should validate all log levels', () => {
      const levels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];

      levels.forEach((level) => {
        const config = minimalValidConfig();
        (config.logging as any).level = level;

        const result = ConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid log level', () => {
      const config = minimalValidConfig();
      (config.logging as any).level = 'invalid-level';

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('metrics section', () => {
    it('should validate metrics configuration', () => {
      const config = minimalValidConfig();
      config.metrics = {
        enabled: false,
        port: 9091,
      };

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should have default metrics values in minimalValidConfig', () => {
      const config = minimalValidConfig();

      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.metrics.enabled).toBe(true);
        expect(result.data.metrics.port).toBe(9090);
      }
    });

    it('should reject metrics port outside valid range', () => {
      const config = minimalValidConfig();
      config.metrics.port = 70000;

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('rateLimit section', () => {
    it('should validate rate limit configuration', () => {
      const config = minimalValidConfig();
      config.rateLimit = {
        windowMs: 600000, // 10 minutes
        max: 200,
      };

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should have default rate limit values in minimalValidConfig', () => {
      const config = minimalValidConfig();

      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.rateLimit.windowMs).toBe(900000); // 15 minutes
        expect(result.data.rateLimit.max).toBe(100);
      }
    });

    it('should reject negative windowMs', () => {
      const config = minimalValidConfig();
      config.rateLimit.windowMs = -1;

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject max less than 1', () => {
      const config = minimalValidConfig();
      config.rateLimit.max = 0;

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('cors section', () => {
    it('should validate CORS configuration', () => {
      const config = minimalValidConfig();
      config.cors = {
        origins: ['http://localhost:3000', 'https://example.com'],
      };

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should have default CORS origins in minimalValidConfig', () => {
      const config = minimalValidConfig();

      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cors.origins).toEqual(['*']);
      }
    });
  });

  describe('security section', () => {
    it('should validate security configuration', () => {
      const config = minimalValidConfig();
      config.security = {
        helmetEnabled: false,
        compressionEnabled: false,
      };

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should have default security values in minimalValidConfig', () => {
      const config = minimalValidConfig();

      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.security.helmetEnabled).toBe(true);
        expect(result.data.security.compressionEnabled).toBe(true);
      }
    });
  });

  describe('websocket section', () => {
    it('should validate WebSocket configuration', () => {
      const config = minimalValidConfig();
      config.websocket = {
        enabled: false,
        port: 3001,
        host: '127.0.0.1',
        pingInterval: 60000,
        pingTimeout: 120000,
        maxConnectionsPerIp: 50,
        maxMessageSize: 2097152, // 2MB
      };

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should have default WebSocket values in minimalValidConfig', () => {
      const config = minimalValidConfig();

      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.websocket.enabled).toBe(true);
        expect(result.data.websocket.port).toBe(3000);
        expect(result.data.websocket.pingInterval).toBe(30000);
        expect(result.data.websocket.pingTimeout).toBe(60000);
        expect(result.data.websocket.maxConnectionsPerIp).toBe(100);
        expect(result.data.websocket.maxMessageSize).toBe(1048576); // 1MB
      }
    });

    it('should reject pingInterval less than 1000ms', () => {
      const config = minimalValidConfig();
      config.websocket.pingInterval = 500;

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject maxMessageSize less than 1KB', () => {
      const config = minimalValidConfig();
      config.websocket.maxMessageSize = 512;

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('graphql section (optional)', () => {
    it('should validate GraphQL configuration', () => {
      const config = minimalValidConfig();
      (config as any).graphql = {
        enabled: true,
        path: '/api/graphql',
        playground: {
          enabled: true,
        },
        complexity: {
          maxDepth: 10,
          maxComplexity: 2000,
        },
        introspection: true,
      };

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should allow missing GraphQL section', () => {
      const config = minimalValidConfig();

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should apply GraphQL defaults when section is provided', () => {
      const config = minimalValidConfig();
      (config as any).graphql = {};

      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(true);
      if (result.success && result.data.graphql) {
        expect(result.data.graphql.enabled).toBe(true);
        expect(result.data.graphql.path).toBe('/graphql');
        expect(result.data.graphql.playground.enabled).toBe(true);
        expect(result.data.graphql.complexity.maxDepth).toBe(5);
        expect(result.data.graphql.complexity.maxComplexity).toBe(1000);
        expect(result.data.graphql.introspection).toBe(true);
      }
    });

    it('should reject maxDepth less than 1', () => {
      const config = minimalValidConfig();
      (config as any).graphql = {
        complexity: {
          maxDepth: 0,
        },
      };

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('tcp section (optional)', () => {
    it('should validate TCP configuration', () => {
      const config = minimalValidConfig();
      (config as any).tcp = {
        enabled: true,
        port: 3002,
        host: '127.0.0.1',
        pingInterval: 60000,
        pingTimeout: 120000,
        maxConnectionsPerIp: 50,
        maxFrameSize: 2097152,
        keepAliveInterval: 60000,
        maxConnections: 1000,
      };

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should allow missing TCP section', () => {
      const config = minimalValidConfig();

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should apply TCP defaults when section is provided', () => {
      const config = minimalValidConfig();
      (config as any).tcp = {};

      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(true);
      if (result.success && result.data.tcp) {
        expect(result.data.tcp.enabled).toBe(true);
        expect(result.data.tcp.port).toBe(3001);
        expect(result.data.tcp.pingInterval).toBe(30000);
        expect(result.data.tcp.pingTimeout).toBe(60000);
        expect(result.data.tcp.maxConnectionsPerIp).toBe(100);
        expect(result.data.tcp.maxFrameSize).toBe(1048576);
        expect(result.data.tcp.keepAliveInterval).toBe(30000);
      }
    });

    it('should reject maxFrameSize less than 1KB', () => {
      const config = minimalValidConfig();
      (config as any).tcp = {
        maxFrameSize: 512,
      };

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should allow optional maxConnections', () => {
      const config = minimalValidConfig();
      (config as any).tcp = {
        maxConnections: 500,
      };

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });

  describe('Boundary values', () => {
    it('should accept port 1 (minimum)', () => {
      const config = minimalValidConfig();
      config.app.port = 1;

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should accept port 65535 (maximum)', () => {
      const config = minimalValidConfig();
      config.app.port = 65535;

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should accept redis db 15 (maximum)', () => {
      const config = minimalValidConfig();
      config.redis.db = 15;

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should accept cache ttl 0 (minimum)', () => {
      const config = minimalValidConfig();
      config.cache.ttl = 0;

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });
});

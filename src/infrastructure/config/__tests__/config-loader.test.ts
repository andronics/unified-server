/**
 * Configuration Loader Tests
 * Tests configuration loading, validation, and environment overrides
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigLoader, getConfig, resetConfig, config } from '../config-loader';

// Mock dependencies
vi.mock('fs');
vi.mock('dotenv', () => ({
  default: { config: vi.fn() },
  config: vi.fn(),
}));

describe('ConfigLoader', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let originalCwd: string;

  beforeEach(() => {
    // Save original environment and cwd
    originalEnv = { ...process.env };
    originalCwd = process.cwd();

    // Clear environment
    process.env = {};

    // Reset config singleton
    resetConfig();

    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original environment and cwd
    process.env = originalEnv;
    vi.spyOn(process, 'cwd').mockReturnValue(originalCwd);
  });

  describe('load()', () => {
    it('should load configuration with defaults when no files or env vars exist', () => {
      // Mock file system to return no config files
      vi.mocked(fs.existsSync).mockReturnValue(false);

      // Set minimum required env vars
      process.env.DB_HOST = 'localhost';
      process.env.DB_NAME = 'test_db';
      process.env.DB_USER = 'test_user';
      process.env.DB_PASSWORD = 'test_password';
      process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-characters-long';

      const config = ConfigLoader.load();

      expect(config).toBeDefined();
      expect(config.app.name).toBe('unified-server');
      expect(config.app.env).toBe('development');
      expect(config.app.port).toBe(3000);
      expect(config.database.host).toBe('localhost');
      expect(config.redis.host).toBe('localhost');
    });

    it('should load and merge default.json config file', () => {
      const defaultConfig = {
        app: {
          name: 'custom-server',
          port: 4000,
        },
        database: {
          host: 'db.example.com',
          name: 'custom_db',
          user: 'custom_user',
          password: 'custom_password',
        },
        auth: {
          jwtSecret: 'file-secret-key-that-is-at-least-32-characters-long',
        },
      };

      // Mock file system
      vi.mocked(fs.existsSync).mockImplementation((filePath) => {
        return filePath.toString().includes('default.json');
      });

      vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
        if (filePath.toString().includes('default.json')) {
          return JSON.stringify(defaultConfig);
        }
        return '{}';
      });

      const config = ConfigLoader.load();

      expect(config.app.name).toBe('custom-server');
      expect(config.app.port).toBe(4000);
      expect(config.database.host).toBe('db.example.com');
    });

    it('should load environment-specific config file', () => {
      process.env.NODE_ENV = 'production';

      const prodConfig = {
        app: {
          port: 8080,
        },
        database: {
          host: 'prod-db.example.com',
          name: 'prod_db',
          user: 'prod_user',
          password: 'prod_password',
        },
        logging: {
          level: 'warn',
        },
        auth: {
          jwtSecret: 'production-secret-key-that-is-at-least-32-chars',
        },
      };

      vi.mocked(fs.existsSync).mockImplementation((filePath) => {
        return filePath.toString().includes('production.json');
      });

      vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
        if (filePath.toString().includes('production.json')) {
          return JSON.stringify(prodConfig);
        }
        return '{}';
      });

      const config = ConfigLoader.load();

      expect(config.app.port).toBe(8080);
      expect(config.database.host).toBe('prod-db.example.com');
      expect(config.logging.level).toBe('warn');
    });

    it('should override config file with environment variables', () => {
      const defaultConfig = {
        app: {
          port: 3000,
        },
        database: {
          host: 'localhost',
          name: 'default_db',
          user: 'default_user',
          password: 'default_password',
        },
        auth: {
          jwtSecret: 'default-secret-key-that-is-at-least-32-chars-long',
        },
      };

      vi.mocked(fs.existsSync).mockImplementation((filePath) => {
        return filePath.toString().includes('default.json');
      });

      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(defaultConfig));

      // Environment variables should override file config
      process.env.PORT = '5000';
      process.env.DB_HOST = 'env-db.example.com';
      process.env.JWT_SECRET = 'env-secret-key-that-is-at-least-32-characters-long';

      const config = ConfigLoader.load();

      expect(config.app.port).toBe(5000);
      expect(config.database.host).toBe('env-db.example.com');
      expect(config.auth.jwtSecret).toBe('env-secret-key-that-is-at-least-32-characters-long');
    });

    it('should apply correct precedence: defaults < default.json < env.json < env vars', () => {
      process.env.NODE_ENV = 'staging';

      const defaultConfig = {
        app: { port: 3000, name: 'default-name' },
        database: {
          host: 'default-db',
          name: 'default_db',
          user: 'default_user',
          password: 'default_password',
        },
        auth: { jwtSecret: 'default-secret-key-that-is-at-least-32-chars' },
      };

      const stagingConfig = {
        app: { port: 4000 }, // Override default.json
        database: {
          host: 'staging-db',
          name: 'staging_db',
          user: 'staging_user',
          password: 'staging_password',
        },
        auth: { jwtSecret: 'staging-secret-key-that-is-at-least-32-chars' },
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
        if (filePath.toString().includes('default.json')) {
          return JSON.stringify(defaultConfig);
        }
        if (filePath.toString().includes('staging.json')) {
          return JSON.stringify(stagingConfig);
        }
        return '{}';
      });

      // Env vars should override everything
      process.env.PORT = '5000';
      process.env.APP_NAME = 'env-name';

      const config = ConfigLoader.load();

      expect(config.app.name).toBe('env-name'); // From env var
      expect(config.app.port).toBe(5000); // From env var
      expect(config.database.host).toBe('staging-db'); // From staging.json
    });

    it('should handle malformed JSON config files gracefully', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('{ invalid json');

      // Should not throw, just warn
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      process.env.DB_HOST = 'localhost';
      process.env.DB_NAME = 'test_db';
      process.env.DB_USER = 'test_user';
      process.env.DB_PASSWORD = 'test_password';
      process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-characters-long';

      const config = ConfigLoader.load();

      expect(config).toBeDefined();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should throw error when validation fails', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      // Missing required fields
      process.env.DB_HOST = 'localhost';
      // Missing DB_NAME, DB_USER, DB_PASSWORD
      process.env.JWT_SECRET = 'short'; // Too short

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => ConfigLoader.load()).toThrow('Invalid configuration');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Configuration validation failed')
      );

      consoleErrorSpy.mockRestore();
    });

    it('should validate JWT secret length', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      process.env.DB_HOST = 'localhost';
      process.env.DB_NAME = 'test_db';
      process.env.DB_USER = 'test_user';
      process.env.DB_PASSWORD = 'test_password';
      process.env.JWT_SECRET = 'too-short'; // Less than 32 characters

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => ConfigLoader.load()).toThrow('Invalid configuration');

      consoleErrorSpy.mockRestore();
    });
  });

  describe('applyEnvOverrides()', () => {
    beforeEach(() => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
    });

    it('should parse all string environment variables', () => {
      process.env.APP_NAME = 'test-app';
      process.env.HOST = '127.0.0.1';
      process.env.DB_HOST = 'db.test.com';
      process.env.DB_NAME = 'test_db';
      process.env.DB_USER = 'test_user';
      process.env.DB_PASSWORD = 'test_password';
      process.env.REDIS_HOST = 'redis.test.com';
      process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-characters-long';
      process.env.GRAPHQL_PATH = '/api/graphql';

      const config = ConfigLoader.load();

      expect(config.app.name).toBe('test-app');
      expect(config.app.host).toBe('127.0.0.1');
      expect(config.database.host).toBe('db.test.com');
      expect(config.redis.host).toBe('redis.test.com');
      expect(config.graphql?.path).toBe('/api/graphql');
    });

    it('should parse integer environment variables', () => {
      process.env.PORT = '8080';
      process.env.DB_PORT = '5433';
      process.env.DB_POOL_MIN = '5';
      process.env.DB_POOL_MAX = '50';
      process.env.REDIS_PORT = '6380';
      process.env.REDIS_DB = '2';
      process.env.CACHE_TTL = '600';
      process.env.METRICS_PORT = '9091';
      process.env.RATE_LIMIT_MAX = '200';
      process.env.SHUTDOWN_TIMEOUT = '60000';

      // Required fields
      process.env.DB_HOST = 'localhost';
      process.env.DB_NAME = 'test_db';
      process.env.DB_USER = 'test_user';
      process.env.DB_PASSWORD = 'test_password';
      process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-characters-long';

      const config = ConfigLoader.load();

      expect(config.app.port).toBe(8080);
      expect(config.app.shutdownTimeout).toBe(60000);
      expect(config.database.port).toBe(5433);
      expect(config.database.poolMin).toBe(5);
      expect(config.database.poolMax).toBe(50);
      expect(config.redis.port).toBe(6380);
      expect(config.redis.db).toBe(2);
      expect(config.cache.ttl).toBe(600);
      expect(config.metrics.port).toBe(9091);
      expect(config.rateLimit.max).toBe(200);
    });

    it('should parse boolean environment variables (true)', () => {
      process.env.LOG_PRETTY = 'true';
      process.env.METRICS_ENABLED = 'true';
      process.env.HELMET_ENABLED = 'true';
      process.env.COMPRESSION_ENABLED = 'true';
      process.env.WEBSOCKET_ENABLED = 'true';
      process.env.GRAPHQL_ENABLED = 'true';
      process.env.GRAPHQL_PLAYGROUND_ENABLED = 'true';
      process.env.TCP_ENABLED = 'true';

      // Required fields
      process.env.DB_HOST = 'localhost';
      process.env.DB_NAME = 'test_db';
      process.env.DB_USER = 'test_user';
      process.env.DB_PASSWORD = 'test_password';
      process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-characters-long';

      const config = ConfigLoader.load();

      expect(config.logging.pretty).toBe(true);
      expect(config.metrics.enabled).toBe(true);
      expect(config.security.helmetEnabled).toBe(true);
      expect(config.security.compressionEnabled).toBe(true);
      expect(config.websocket.enabled).toBe(true);
      expect(config.graphql?.enabled).toBe(true);
      expect(config.graphql?.playground.enabled).toBe(true);
      expect(config.tcp?.enabled).toBe(true);
    });

    it('should parse boolean environment variables (false)', () => {
      process.env.LOG_PRETTY = 'false';
      process.env.METRICS_ENABLED = 'false';
      process.env.WEBSOCKET_ENABLED = 'false';

      // Required fields
      process.env.DB_HOST = 'localhost';
      process.env.DB_NAME = 'test_db';
      process.env.DB_USER = 'test_user';
      process.env.DB_PASSWORD = 'test_password';
      process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-characters-long';

      const config = ConfigLoader.load();

      expect(config.logging.pretty).toBe(false);
      expect(config.metrics.enabled).toBe(false);
      expect(config.websocket.enabled).toBe(false);
    });

    it('should parse boolean "1" as true', () => {
      process.env.METRICS_ENABLED = '1';

      // Required fields
      process.env.DB_HOST = 'localhost';
      process.env.DB_NAME = 'test_db';
      process.env.DB_USER = 'test_user';
      process.env.DB_PASSWORD = 'test_password';
      process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-characters-long';

      const config = ConfigLoader.load();

      expect(config.metrics.enabled).toBe(true);
    });

    it('should parse CORS origins from comma-separated string', () => {
      process.env.CORS_ORIGINS = 'http://localhost:3000,https://example.com,https://api.example.com';

      // Required fields
      process.env.DB_HOST = 'localhost';
      process.env.DB_NAME = 'test_db';
      process.env.DB_USER = 'test_user';
      process.env.DB_PASSWORD = 'test_password';
      process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-characters-long';

      const config = ConfigLoader.load();

      expect(config.cors.origins).toEqual([
        'http://localhost:3000',
        'https://example.com',
        'https://api.example.com',
      ]);
    });

    it('should handle invalid integer strings by using defaults', () => {
      process.env.PORT = 'not-a-number';
      process.env.DB_PORT = 'invalid';

      // Required fields
      process.env.DB_HOST = 'localhost';
      process.env.DB_NAME = 'test_db';
      process.env.DB_USER = 'test_user';
      process.env.DB_PASSWORD = 'test_password';
      process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-characters-long';

      const config = ConfigLoader.load();

      expect(config.app.port).toBe(3000); // Default
      expect(config.database.port).toBe(5432); // Default
    });

    it('should parse environment enum values', () => {
      process.env.NODE_ENV = 'production';
      process.env.LOG_LEVEL = 'warn';

      // Required fields
      process.env.DB_HOST = 'localhost';
      process.env.DB_NAME = 'test_db';
      process.env.DB_USER = 'test_user';
      process.env.DB_PASSWORD = 'test_password';
      process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-characters-long';

      const config = ConfigLoader.load();

      expect(config.app.env).toBe('production');
      expect(config.logging.level).toBe('warn');
    });
  });

  describe('deepMerge()', () => {
    it('should deep merge nested objects', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const defaultConfig = {
        app: {
          name: 'default-app',
          port: 3000,
        },
        database: {
          host: 'default-db',
          port: 5432,
          name: 'default_db',
          user: 'default_user',
          password: 'default_password',
        },
        auth: {
          jwtSecret: 'default-secret-key-that-is-at-least-32-chars',
        },
      };

      const envConfig = {
        app: {
          port: 4000, // Override port but keep name
        },
        database: {
          host: 'env-db', // Override host but keep other fields
          name: 'env_db',
          user: 'env_user',
          password: 'env_password',
        },
        auth: {
          jwtSecret: 'env-secret-key-that-is-at-least-32-characters-long',
        },
      };

      vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
        if (filePath.toString().includes('default.json')) {
          return JSON.stringify(defaultConfig);
        }
        if (filePath.toString().includes('development.json')) {
          return JSON.stringify(envConfig);
        }
        return '{}';
      });

      const config = ConfigLoader.load();

      // Should have merged values
      expect(config.app.name).toBe('default-app'); // From default
      expect(config.app.port).toBe(4000); // From env
      expect(config.database.host).toBe('env-db'); // From env
      expect(config.database.port).toBe(5432); // From default
    });

    it('should not merge arrays, just replace them', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const defaultConfig = {
        cors: {
          origins: ['http://localhost:3000'],
        },
        database: {
          host: 'localhost',
          name: 'default_db',
          user: 'default_user',
          password: 'default_password',
        },
        auth: {
          jwtSecret: 'default-secret-key-that-is-at-least-32-chars',
        },
      };

      const envConfig = {
        cors: {
          origins: ['https://example.com', 'https://api.example.com'],
        },
      };

      vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
        if (filePath.toString().includes('default.json')) {
          return JSON.stringify(defaultConfig);
        }
        if (filePath.toString().includes('development.json')) {
          return JSON.stringify(envConfig);
        }
        return '{}';
      });

      const config = ConfigLoader.load();

      // Array should be replaced, not merged
      expect(config.cors.origins).toEqual(['https://example.com', 'https://api.example.com']);
    });
  });

  describe('getConfig() and resetConfig()', () => {
    it('should return same instance on multiple calls (singleton)', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      process.env.DB_HOST = 'localhost';
      process.env.DB_NAME = 'test_db';
      process.env.DB_USER = 'test_user';
      process.env.DB_PASSWORD = 'test_password';
      process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-characters-long';

      const config1 = getConfig();
      const config2 = getConfig();

      expect(config1).toBe(config2); // Same instance
    });

    it('should reload config after reset', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      process.env.DB_HOST = 'localhost';
      process.env.DB_NAME = 'test_db';
      process.env.DB_USER = 'test_user';
      process.env.DB_PASSWORD = 'test_password';
      process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-characters-long';
      process.env.PORT = '3000';

      const config1 = getConfig();
      expect(config1.app.port).toBe(3000);

      // Change environment and reset
      process.env.PORT = '4000';
      resetConfig();

      const config2 = getConfig();
      expect(config2.app.port).toBe(4000);
      expect(config1).not.toBe(config2); // Different instances
    });
  });

  describe('config proxy', () => {
    it('should lazily load config on first property access', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      process.env.DB_HOST = 'localhost';
      process.env.DB_NAME = 'test_db';
      process.env.DB_USER = 'test_user';
      process.env.DB_PASSWORD = 'test_password';
      process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-characters-long';

      // Access config proxy (already imported at top)
      // Should load on first access
      expect(config.app.name).toBe('unified-server');
      expect(config.database.host).toBe('localhost');
    });
  });

  describe('Environment-specific configurations', () => {
    it('should load development config by default', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      delete process.env.NODE_ENV;

      process.env.DB_HOST = 'localhost';
      process.env.DB_NAME = 'test_db';
      process.env.DB_USER = 'test_user';
      process.env.DB_PASSWORD = 'test_password';
      process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-characters-long';

      const config = ConfigLoader.load();

      expect(config.app.env).toBe('development');
    });

    it('should load test config when NODE_ENV=test', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      process.env.NODE_ENV = 'test';

      process.env.DB_HOST = 'localhost';
      process.env.DB_NAME = 'test_db';
      process.env.DB_USER = 'test_user';
      process.env.DB_PASSWORD = 'test_password';
      process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-characters-long';

      const config = ConfigLoader.load();

      expect(config.app.env).toBe('test');
    });

    it('should load staging config when NODE_ENV=staging', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      process.env.NODE_ENV = 'staging';

      process.env.DB_HOST = 'localhost';
      process.env.DB_NAME = 'test_db';
      process.env.DB_USER = 'test_user';
      process.env.DB_PASSWORD = 'test_password';
      process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-characters-long';

      const config = ConfigLoader.load();

      expect(config.app.env).toBe('staging');
    });

    it('should load production config when NODE_ENV=production', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      process.env.NODE_ENV = 'production';

      process.env.DB_HOST = 'localhost';
      process.env.DB_NAME = 'test_db';
      process.env.DB_USER = 'test_user';
      process.env.DB_PASSWORD = 'test_password';
      process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-characters-long';

      const config = ConfigLoader.load();

      expect(config.app.env).toBe('production');
    });
  });

  describe('Optional configuration sections', () => {
    it('should handle optional TCP configuration', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      process.env.DB_HOST = 'localhost';
      process.env.DB_NAME = 'test_db';
      process.env.DB_USER = 'test_user';
      process.env.DB_PASSWORD = 'test_password';
      process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-characters-long';
      process.env.TCP_ENABLED = 'true';
      process.env.TCP_PORT = '3001';

      const config = ConfigLoader.load();

      expect(config.tcp).toBeDefined();
      expect(config.tcp?.enabled).toBe(true);
      expect(config.tcp?.port).toBe(3001);
    });

    it('should handle optional GraphQL configuration', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      process.env.DB_HOST = 'localhost';
      process.env.DB_NAME = 'test_db';
      process.env.DB_USER = 'test_user';
      process.env.DB_PASSWORD = 'test_password';
      process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-characters-long';
      process.env.GRAPHQL_ENABLED = 'true';
      process.env.GRAPHQL_PATH = '/api/graphql';

      const config = ConfigLoader.load();

      expect(config.graphql).toBeDefined();
      expect(config.graphql?.enabled).toBe(true);
      expect(config.graphql?.path).toBe('/api/graphql');
    });
  });
});

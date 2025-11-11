/**
 * PostgreSQL connection pool
 * Layer 3: Integration
 */

import { Pool, PoolClient, QueryResult } from 'pg';
import { config } from '@infrastructure/config/config-loader';
import { logger } from '@infrastructure/logging/logger';
import { metricsService } from '@infrastructure/metrics/metrics';
import { ApiError } from '@foundation/errors/api-error';

/**
 * Database connection pool
 */
export class DatabasePool {
  private pool: Pool;
  private isConnected: boolean = false;

  constructor() {
    this.pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      min: config.database.poolMin,
      max: config.database.poolMax,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    // Pool error handler
    this.pool.on('error', (err) => {
      logger.error({ error: err }, 'Unexpected database pool error');
    });

    // Pool connection handler
    this.pool.on('connect', () => {
      metricsService.databaseConnectionsActive.inc();
    });

    // Pool disconnect handler
    this.pool.on('remove', () => {
      metricsService.databaseConnectionsActive.dec();
    });
  }

  /**
   * Connect to the database
   */
  async connect(): Promise<void> {
    try {
      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      this.isConnected = true;
      logger.info(
        {
          host: config.database.host,
          database: config.database.name,
          poolMin: config.database.poolMin,
          poolMax: config.database.poolMax,
        },
        '✓ Database connected'
      );
    } catch (error) {
      this.isConnected = false;
      logger.error({ error }, 'Failed to connect to database');
      throw ApiError.databaseError('Database connection failed');
    }
  }

  /**
   * Disconnect from the database
   */
  async disconnect(): Promise<void> {
    try {
      await this.pool.end();
      this.isConnected = false;
      logger.info('Database disconnected');
    } catch (error) {
      logger.error({ error }, 'Error disconnecting from database');
      throw error;
    }
  }

  /**
   * Execute a query
   */
  async query<T extends Record<string, any> = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const start = Date.now();

    try {
      const result = await this.pool.query<T>(text, params);
      const duration = (Date.now() - start) / 1000;

      metricsService.databaseQueriesTotal.inc({ operation: 'query', status: 'success' });
      metricsService.databaseQueryDuration.observe({ operation: 'query' }, duration);

      logger.debug(
        {
          query: text.substring(0, 100),
          rows: result.rowCount,
          duration,
        },
        'Database query executed'
      );

      return result;
    } catch (error) {
      const duration = (Date.now() - start) / 1000;

      metricsService.databaseQueriesTotal.inc({ operation: 'query', status: 'error' });
      metricsService.databaseQueryDuration.observe({ operation: 'query' }, duration);

      logger.error(
        {
          error,
          query: text.substring(0, 100),
          params,
          duration,
        },
        'Database query failed'
      );

      // Preserve original error details for repository layer to handle
      const apiError = ApiError.databaseError('Database query failed', { query: text });
      (apiError as any).originalError = error;
      throw apiError;
    }
  }

  /**
   * Get a client from the pool for transactions
   */
  async getClient(): Promise<PoolClient> {
    try {
      const client = await this.pool.connect();
      return client;
    } catch (error) {
      logger.error({ error }, 'Failed to get database client');
      throw ApiError.databaseError('Failed to get database connection');
    }
  }

  /**
   * Execute a transaction
   */
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient();
    const start = Date.now();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');

      const duration = (Date.now() - start) / 1000;
      metricsService.databaseQueriesTotal.inc({ operation: 'transaction', status: 'success' });
      metricsService.databaseQueryDuration.observe({ operation: 'transaction' }, duration);

      logger.debug({ duration }, 'Transaction completed successfully');

      return result;
    } catch (error) {
      await client.query('ROLLBACK');

      const duration = (Date.now() - start) / 1000;
      metricsService.databaseQueriesTotal.inc({ operation: 'transaction', status: 'error' });
      metricsService.databaseQueryDuration.observe({ operation: 'transaction' }, duration);

      logger.error({ error, duration }, 'Transaction failed and rolled back');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check if database is connected
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.query('SELECT 1');
      return result.rowCount === 1;
    } catch (error) {
      logger.error({ error }, 'Database health check failed');
      return false;
    }
  }

  /**
   * Get connection status
   */
  isHealthy(): boolean {
    return this.isConnected;
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };
  }
}

// Export singleton instance
export const database = new DatabasePool();

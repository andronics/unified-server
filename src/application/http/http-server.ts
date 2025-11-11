/**
 * HTTP Server setup
 * Layer 4: Application
 */

import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from '@infrastructure/config/config-loader';
import { logger } from '@infrastructure/logging/logger';

// Middleware
import { loggingMiddleware } from './middleware/logging-middleware';
import { metricsMiddleware } from './middleware/metrics-middleware';
import { errorHandler, notFoundHandler } from './middleware/error-handler';

// Routes
import authRoutes from './routes/auth-routes';
import userRoutes from './routes/user-routes';
import messageRoutes from './routes/message-routes';
import healthRoutes from './routes/health-routes';

// GraphQL
import { createGraphQLServer } from '../graphql/graphql-server';

/**
 * HTTP Server class
 */
export class HttpServer {
  private app: Express;
  private server: any;
  private httpServer: any; // Node HTTP server instance

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup middleware
   */
  private setupMiddleware(): void {
    // Security middleware
    if (config.security.helmetEnabled) {
      this.app.use(helmet());
    }

    // CORS
    this.app.use(
      cors({
        origin: config.cors.origins,
        credentials: true,
      })
    );

    // Compression
    if (config.security.compressionEnabled) {
      this.app.use(compression());
    }

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Rate limiting (disabled in test environment)
    if (config.app.env !== 'test') {
      const limiter = rateLimit({
        windowMs: config.rateLimit.windowMs,
        max: config.rateLimit.max,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (_req, res) => {
          res.status(429).json({
            success: false,
            error: {
              code: 8,
              message: 'Too many requests, please try again later',
            },
            timestamp: new Date().toISOString(),
          });
        },
      });
      this.app.use(limiter);
    }

    // Custom middleware
    this.app.use(loggingMiddleware);
    this.app.use(metricsMiddleware);
  }

  /**
   * Setup routes
   */
  private setupRoutes(): void {
    // Health check routes (no /api prefix, used by load balancers)
    this.app.use('/health', healthRoutes);

    // GraphQL endpoint
    if (config.graphql?.enabled) {
      const graphqlServer = createGraphQLServer();
      this.app.use(config.graphql.path || '/graphql', graphqlServer);
      logger.info(
        {
          path: config.graphql.path || '/graphql',
          playground: config.graphql.playground?.enabled ?? true,
        },
        'GraphQL endpoint mounted'
      );
    }

    // API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/users', userRoutes);
    this.app.use('/api/messages', messageRoutes);

    // Root route
    this.app.get('/', (_req, res) => {
      res.json({
        name: config.app.name,
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString(),
      });
    });
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    // 404 handler (must be after all routes)
    this.app.use(notFoundHandler);

    // Error handler (must be last)
    this.app.use(errorHandler);
  }

  /**
   * Start the HTTP server
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer = this.app.listen(config.app.port, config.app.host, () => {
        this.server = this.httpServer; // Keep for backward compatibility
        logger.info(
          {
            port: config.app.port,
            host: config.app.host,
            env: config.app.env,
          },
          '✓ HTTP server started'
        );
        resolve();
      });
    });
  }

  /**
   * Stop the HTTP server
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((err: Error) => {
        if (err) {
          logger.error({ error: err }, 'Error stopping HTTP server');
          reject(err);
        } else {
          logger.info('HTTP server stopped');
          resolve();
        }
      });
    });
  }

  /**
   * Get Express app instance
   */
  getApp(): Express {
    return this.app;
  }

  /**
   * Get Node HTTP server instance (for WebSocket attachment)
   */
  getHttpServer(): any {
    return this.httpServer;
  }
}

// Export singleton instance
export const httpServer = new HttpServer();

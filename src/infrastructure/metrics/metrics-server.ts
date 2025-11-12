/**
 * Metrics server for Prometheus
 * Layer 4: Application
 */

import express, { Express, Request, Response } from 'express';
import { config } from '@infrastructure/config/config-loader';
import { logger } from '@infrastructure/logging/logger';
import { metricsService } from '@infrastructure/metrics/metrics';

/**
 * Metrics server class
 */
export class MetricsServer {
  private app: Express;
  private server: any;

  constructor() {
    this.app = express();
    this.setupRoutes();
  }

  /**
   * Setup routes
   */
  private setupRoutes(): void {
    /**
     * GET /metrics
     * Prometheus metrics endpoint
     */
    this.app.get('/metrics', async (_req: Request, res: Response) => {
      try {
        res.set('Content-Type', metricsService.registry.contentType);
        const metrics = await metricsService.getMetrics();
        res.send(metrics);
      } catch (error) {
        logger.error({ error }, 'Failed to generate metrics');
        res.status(500).send('Failed to generate metrics');
      }
    });

    /**
     * GET /metrics/json
     * Metrics in JSON format
     */
    this.app.get('/metrics/json', async (_req: Request, res: Response) => {
      try {
        const metrics = await metricsService.getMetricsJSON();
        res.json(metrics);
      } catch (error) {
        logger.error({ error }, 'Failed to generate metrics JSON');
        res.status(500).json({ error: 'Failed to generate metrics' });
      }
    });

    /**
     * GET /
     * Root endpoint
     */
    this.app.get('/', (_req: Request, res: Response) => {
      res.json({
        service: 'metrics',
        endpoints: {
          metrics: '/metrics',
          metricsJson: '/metrics/json',
        },
      });
    });
  }

  /**
   * Start the metrics server
   */
  async start(): Promise<void> {
    if (!config.metrics.enabled) {
      logger.info('Metrics server disabled');
      return;
    }

    return new Promise((resolve) => {
      this.server = this.app.listen(config.metrics.port, () => {
        logger.info(
          {
            port: config.metrics.port,
          },
          '✓ Metrics server started'
        );
        resolve();
      });
    });
  }

  /**
   * Stop the metrics server
   */
  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.server.close((err: Error) => {
        if (err) {
          logger.error({ error: err }, 'Error stopping metrics server');
          reject(err);
        } else {
          logger.info('Metrics server stopped');
          resolve();
        }
      });
    });
  }
}

// Export singleton instance
export const metricsServer = new MetricsServer();

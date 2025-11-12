/**
 * Main server entry point
 * Unified Multi-Protocol Server - HTTP-First Implementation
 */

import { config } from '@infrastructure/config/config-loader';
import {
  logger,
  logStartup,
  logShutdown,
  logUncaughtException,
  logUnhandledRejection,
} from '@infrastructure/logging/logger';
import { database } from '@infrastructure/database/connection-pool';
import { redisClient } from '@infrastructure/cache/redis-client';
import { pubSubBroker } from '@infrastructure/pubsub/pubsub-broker';
import { httpServer } from '@protocols/http/http-server';
import { metricsServer } from '@infrastructure/metrics/metrics-server';
import {
  connectionManager,
  initializeMessageHandler,
  initializeWebSocketServer,
  initializeEventBridge,
} from '@protocols/websocket';
import { createTcpServer, createTcpMessageHandler } from '@protocols/tcp';
import { eventBus } from '@infrastructure/events/event-bus';

/**
 * Application class
 */
class Application {
  private isShuttingDown = false;
  private websocketServer: any = null;
  private eventBridge: any = null;
  private tcpServer: any = null;

  /**
   * Initialize all dependencies
   */
  async initialize(): Promise<void> {
    logger.info('Initializing application...');

    // Connect to database
    await database.connect();

    // Redis connection is automatic (handled by constructor)
    // Wait a moment for it to connect
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Connect PubSub broker
    await pubSubBroker.connect();

    logger.info('✓ All dependencies initialized');
  }

  /**
   * Start all servers
   */
  async start(): Promise<void> {
    try {
      // Initialize dependencies
      await this.initialize();

      // Start HTTP server first
      await httpServer.start();

      // Initialize and start WebSocket server (attached to HTTP server)
      if (config.websocket.enabled) {
        const messageHandler = initializeMessageHandler(connectionManager);
        this.websocketServer = initializeWebSocketServer(connectionManager, messageHandler);
        await this.websocketServer.start(httpServer.getHttpServer());

        // Initialize event bridge (EventBus → PubSub → WebSocket/TCP)
        this.eventBridge = initializeEventBridge(eventBus, pubSubBroker);
        await this.eventBridge.start();
      }

      // Initialize and start TCP server (independent port)
      if (config.tcp?.enabled) {
        this.tcpServer = createTcpServer(config);
        createTcpMessageHandler(this.tcpServer); // Sets up event listeners
        await this.tcpServer.start();

        logger.info(
          {
            port: config.tcp.port,
            host: config.tcp.host,
          },
          'TCP server started'
        );
      }

      // Start metrics server
      await metricsServer.start();

      logStartup(config.app.port);

      logger.info(
        {
          endpoints: {
            api: `http://${config.app.host}:${config.app.port}/api`,
            websocket: config.websocket.enabled
              ? `ws://${config.app.host}:${config.app.port}/ws`
              : 'disabled',
            tcp: config.tcp?.enabled
              ? `tcp://${config.tcp.host}:${config.tcp.port}`
              : 'disabled',
            health: `http://${config.app.host}:${config.app.port}/health`,
            metrics: config.metrics.enabled
              ? `http://localhost:${config.metrics.port}/metrics`
              : 'disabled',
          },
        },
        '🚀 Server ready to accept connections'
      );
    } catch (error) {
      logger.fatal({ error }, 'Failed to start application');
      process.exit(1);
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;
    logShutdown(signal);

    try {
      // Stop event bridge first
      if (this.eventBridge) {
        await this.eventBridge.stop();
      }

      // Stop TCP server (close all connections gracefully)
      if (this.tcpServer) {
        await this.tcpServer.stop();
      }

      // Stop WebSocket server (close all connections gracefully)
      if (this.websocketServer) {
        await this.websocketServer.stop();
      }

      // Stop accepting new HTTP connections
      await httpServer.stop();
      await metricsServer.stop();

      // Disconnect PubSub broker
      await pubSubBroker.disconnect();

      // Close database connections
      await database.disconnect();
      await redisClient.disconnect();

      logger.info('✓ Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error({ error }, 'Error during shutdown');
      process.exit(1);
    }
  }

  /**
   * Setup process event handlers
   */
  setupProcessHandlers(): void {
    // Graceful shutdown signals
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    process.on('SIGINT', () => this.shutdown('SIGINT'));

    // Error handlers
    process.on('uncaughtException', (error) => {
      logUncaughtException(error);
      this.shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason) => {
      logUnhandledRejection(reason);
      this.shutdown('unhandledRejection');
    });
  }
}

// Bootstrap application
const app = new Application();
app.setupProcessHandlers();
app.start();

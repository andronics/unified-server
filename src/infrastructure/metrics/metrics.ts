/**
 * Prometheus metrics collection
 * Layer 2: Infrastructure
 */

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import { config } from '../config/config-loader';

/**
 * Metrics registry and collectors
 */
export class MetricsService {
  public readonly registry: Registry;

  // HTTP metrics
  public readonly httpRequestsTotal: Counter;
  public readonly httpRequestDuration: Histogram;
  public readonly httpRequestSize: Histogram;
  public readonly httpResponseSize: Histogram;

  // Application metrics
  public readonly activeConnections: Gauge;
  public readonly eventsEmitted: Counter;
  public readonly eventsHandled: Counter;

  // Database metrics
  public readonly databaseQueriesTotal: Counter;
  public readonly databaseQueryDuration: Histogram;
  public readonly databaseConnectionsActive: Gauge;

  // Cache metrics
  public readonly cacheHits: Counter;
  public readonly cacheMisses: Counter;
  public readonly cacheOperationDuration: Histogram;

  // Auth metrics
  public readonly authAttemptsTotal: Counter;
  public readonly authSuccessTotal: Counter;
  public readonly authFailuresTotal: Counter;

  // TCP metrics
  public readonly tcpConnectionsTotal: Counter;
  public readonly tcpConnectionsActive: Gauge;
  public readonly tcpMessagesReceived: Counter;
  public readonly tcpMessagesSent: Counter;
  public readonly tcpBytesReceived: Counter;
  public readonly tcpBytesSent: Counter;
  public readonly tcpFramesParsed: Counter;
  public readonly tcpFrameErrors: Counter;
  public readonly tcpMessageDuration: Histogram;

  constructor() {
    this.registry = new Registry();

    // Collect default metrics (CPU, memory, etc.)
    if (config.metrics.enabled) {
      collectDefaultMetrics({
        register: this.registry,
        prefix: 'unified_server_',
      });
    }

    // HTTP metrics
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'path', 'status'],
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'path', 'status'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
      registers: [this.registry],
    });

    this.httpRequestSize = new Histogram({
      name: 'http_request_size_bytes',
      help: 'HTTP request size in bytes',
      labelNames: ['method', 'path'],
      buckets: [100, 1000, 10000, 100000, 1000000],
      registers: [this.registry],
    });

    this.httpResponseSize = new Histogram({
      name: 'http_response_size_bytes',
      help: 'HTTP response size in bytes',
      labelNames: ['method', 'path'],
      buckets: [100, 1000, 10000, 100000, 1000000],
      registers: [this.registry],
    });

    // Application metrics
    this.activeConnections = new Gauge({
      name: 'active_connections',
      help: 'Number of active connections',
      registers: [this.registry],
    });

    this.eventsEmitted = new Counter({
      name: 'events_emitted_total',
      help: 'Total number of events emitted',
      labelNames: ['event_type'],
      registers: [this.registry],
    });

    this.eventsHandled = new Counter({
      name: 'events_handled_total',
      help: 'Total number of events handled',
      labelNames: ['event_type', 'status'],
      registers: [this.registry],
    });

    // Database metrics
    this.databaseQueriesTotal = new Counter({
      name: 'database_queries_total',
      help: 'Total number of database queries',
      labelNames: ['operation', 'status'],
      registers: [this.registry],
    });

    this.databaseQueryDuration = new Histogram({
      name: 'database_query_duration_seconds',
      help: 'Database query duration in seconds',
      labelNames: ['operation'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
      registers: [this.registry],
    });

    this.databaseConnectionsActive = new Gauge({
      name: 'database_connections_active',
      help: 'Number of active database connections',
      registers: [this.registry],
    });

    // Cache metrics
    this.cacheHits = new Counter({
      name: 'cache_hits_total',
      help: 'Total number of cache hits',
      registers: [this.registry],
    });

    this.cacheMisses = new Counter({
      name: 'cache_misses_total',
      help: 'Total number of cache misses',
      registers: [this.registry],
    });

    this.cacheOperationDuration = new Histogram({
      name: 'cache_operation_duration_seconds',
      help: 'Cache operation duration in seconds',
      labelNames: ['operation'],
      buckets: [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1],
      registers: [this.registry],
    });

    // Auth metrics
    this.authAttemptsTotal = new Counter({
      name: 'auth_attempts_total',
      help: 'Total number of authentication attempts',
      labelNames: ['method'],
      registers: [this.registry],
    });

    this.authSuccessTotal = new Counter({
      name: 'auth_success_total',
      help: 'Total number of successful authentications',
      labelNames: ['method'],
      registers: [this.registry],
    });

    this.authFailuresTotal = new Counter({
      name: 'auth_failures_total',
      help: 'Total number of failed authentications',
      labelNames: ['method', 'reason'],
      registers: [this.registry],
    });

    // TCP metrics
    this.tcpConnectionsTotal = new Counter({
      name: 'tcp_connections_total',
      help: 'Total number of TCP connections',
      labelNames: ['status'],
      registers: [this.registry],
    });

    this.tcpConnectionsActive = new Gauge({
      name: 'tcp_connections_active',
      help: 'Number of active TCP connections',
      registers: [this.registry],
    });

    this.tcpMessagesReceived = new Counter({
      name: 'tcp_messages_received_total',
      help: 'Total number of TCP messages received',
      labelNames: ['type'],
      registers: [this.registry],
    });

    this.tcpMessagesSent = new Counter({
      name: 'tcp_messages_sent_total',
      help: 'Total number of TCP messages sent',
      labelNames: ['type'],
      registers: [this.registry],
    });

    this.tcpBytesReceived = new Counter({
      name: 'tcp_bytes_received_total',
      help: 'Total bytes received over TCP',
      registers: [this.registry],
    });

    this.tcpBytesSent = new Counter({
      name: 'tcp_bytes_sent_total',
      help: 'Total bytes sent over TCP',
      registers: [this.registry],
    });

    this.tcpFramesParsed = new Counter({
      name: 'tcp_frames_parsed_total',
      help: 'Total number of TCP frames successfully parsed',
      registers: [this.registry],
    });

    this.tcpFrameErrors = new Counter({
      name: 'tcp_frame_errors_total',
      help: 'Total number of TCP frame parsing errors',
      labelNames: ['error_type'],
      registers: [this.registry],
    });

    this.tcpMessageDuration = new Histogram({
      name: 'tcp_message_duration_seconds',
      help: 'TCP message processing duration in seconds',
      labelNames: ['type'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
      registers: [this.registry],
    });
  }

  /**
   * Get metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * Get metrics as JSON
   */
  async getMetricsJSON(): Promise<unknown> {
    return this.registry.getMetricsAsJSON();
  }

  /**
   * Clear all metrics (useful for testing)
   */
  clear(): void {
    this.registry.clear();
  }
}

// Export singleton instance
export const metricsService = new MetricsService();

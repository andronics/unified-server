/**
 * Metrics Service Tests
 * Tests Prometheus metrics collection and registration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

// Mock prom-client BEFORE importing metrics
vi.mock('prom-client', () => {
  const MockCounter = vi.fn().mockImplementation(function (this: any, config: any) {
    this.name = config.name;
    this.help = config.help;
    this.labelNames = config.labelNames || [];
    this.inc = vi.fn();
    return this;
  });

  const MockHistogram = vi.fn().mockImplementation(function (this: any, config: any) {
    this.name = config.name;
    this.help = config.help;
    this.labelNames = config.labelNames || [];
    this.buckets = config.buckets;
    this.observe = vi.fn();
    return this;
  });

  const MockGauge = vi.fn().mockImplementation(function (this: any, config: any) {
    this.name = config.name;
    this.help = config.help;
    this.inc = vi.fn();
    this.dec = vi.fn();
    this.set = vi.fn();
    return this;
  });

  const MockRegistry = vi.fn().mockImplementation(function (this: any) {
    this.metrics = vi.fn().mockResolvedValue('# Mock metrics\nmetric_name 1.0\n');
    this.getMetricsAsJSON = vi.fn().mockResolvedValue([{ name: 'mock_metric', value: 1.0 }]);
    this.clear = vi.fn();
    return this;
  });

  return {
    Registry: MockRegistry,
    Counter: MockCounter,
    Histogram: MockHistogram,
    Gauge: MockGauge,
    collectDefaultMetrics: vi.fn(),
  };
});

vi.mock('@infrastructure/config/config-loader', () => ({
  config: {
    metrics: {
      enabled: true,
      port: 9090,
    },
  },
}));

// Import metrics AFTER mocks are set up
import { MetricsService, metricsService } from '../metrics';

describe('MetricsService', () => {
  let testMetricsService: MetricsService;

  beforeEach(() => {
    vi.clearAllMocks();
    testMetricsService = new MetricsService();
  });

  describe('Constructor', () => {
    it('should create a registry', () => {
      expect(Registry).toHaveBeenCalled();
      expect(testMetricsService.registry).toBeDefined();
    });

    it('should collect default metrics when enabled', () => {
      expect(collectDefaultMetrics).toHaveBeenCalledWith({
        register: expect.any(Object),
        prefix: 'unified_server_',
      });
    });

    it('should create all HTTP metrics', () => {
      expect(testMetricsService.httpRequestsTotal).toBeDefined();
      expect(testMetricsService.httpRequestDuration).toBeDefined();
      expect(testMetricsService.httpRequestSize).toBeDefined();
      expect(testMetricsService.httpResponseSize).toBeDefined();
    });

    it('should create all application metrics', () => {
      expect(testMetricsService.activeConnections).toBeDefined();
      expect(testMetricsService.eventsEmitted).toBeDefined();
      expect(testMetricsService.eventsHandled).toBeDefined();
    });

    it('should create all database metrics', () => {
      expect(testMetricsService.databaseQueriesTotal).toBeDefined();
      expect(testMetricsService.databaseQueryDuration).toBeDefined();
      expect(testMetricsService.databaseConnectionsActive).toBeDefined();
    });

    it('should create all cache metrics', () => {
      expect(testMetricsService.cacheHits).toBeDefined();
      expect(testMetricsService.cacheMisses).toBeDefined();
      expect(testMetricsService.cacheOperationDuration).toBeDefined();
    });

    it('should create all auth metrics', () => {
      expect(testMetricsService.authAttemptsTotal).toBeDefined();
      expect(testMetricsService.authSuccessTotal).toBeDefined();
      expect(testMetricsService.authFailuresTotal).toBeDefined();
    });

    it('should create all TCP metrics', () => {
      expect(testMetricsService.tcpConnectionsTotal).toBeDefined();
      expect(testMetricsService.tcpConnectionsActive).toBeDefined();
      expect(testMetricsService.tcpMessagesReceived).toBeDefined();
      expect(testMetricsService.tcpMessagesSent).toBeDefined();
      expect(testMetricsService.tcpBytesReceived).toBeDefined();
      expect(testMetricsService.tcpBytesSent).toBeDefined();
      expect(testMetricsService.tcpFramesParsed).toBeDefined();
      expect(testMetricsService.tcpFrameErrors).toBeDefined();
      expect(testMetricsService.tcpMessageDuration).toBeDefined();
    });
  });

  describe('HTTP metrics configuration', () => {
    it('should configure httpRequestsTotal counter', () => {
      expect(Counter).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'http_requests_total',
          help: 'Total number of HTTP requests',
          labelNames: ['method', 'path', 'status'],
        })
      );
    });

    it('should configure httpRequestDuration histogram with buckets', () => {
      expect(Histogram).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'http_request_duration_seconds',
          help: 'HTTP request duration in seconds',
          labelNames: ['method', 'path', 'status'],
          buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
        })
      );
    });

    it('should configure httpRequestSize histogram', () => {
      expect(Histogram).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'http_request_size_bytes',
          help: 'HTTP request size in bytes',
          labelNames: ['method', 'path'],
          buckets: [100, 1000, 10000, 100000, 1000000],
        })
      );
    });

    it('should configure httpResponseSize histogram', () => {
      expect(Histogram).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'http_response_size_bytes',
          help: 'HTTP response size in bytes',
          labelNames: ['method', 'path'],
          buckets: [100, 1000, 10000, 100000, 1000000],
        })
      );
    });
  });

  describe('Application metrics configuration', () => {
    it('should configure activeConnections gauge', () => {
      expect(Gauge).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'active_connections',
          help: 'Number of active connections',
        })
      );
    });

    it('should configure eventsEmitted counter', () => {
      expect(Counter).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'events_emitted_total',
          help: 'Total number of events emitted',
          labelNames: ['event_type'],
        })
      );
    });

    it('should configure eventsHandled counter', () => {
      expect(Counter).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'events_handled_total',
          help: 'Total number of events handled',
          labelNames: ['event_type', 'status'],
        })
      );
    });
  });

  describe('Database metrics configuration', () => {
    it('should configure databaseQueriesTotal counter', () => {
      expect(Counter).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'database_queries_total',
          help: 'Total number of database queries',
          labelNames: ['operation', 'status'],
        })
      );
    });

    it('should configure databaseQueryDuration histogram', () => {
      expect(Histogram).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'database_query_duration_seconds',
          help: 'Database query duration in seconds',
          labelNames: ['operation'],
          buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
        })
      );
    });

    it('should configure databaseConnectionsActive gauge', () => {
      expect(Gauge).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'database_connections_active',
          help: 'Number of active database connections',
        })
      );
    });
  });

  describe('Cache metrics configuration', () => {
    it('should configure cacheHits counter', () => {
      expect(Counter).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'cache_hits_total',
          help: 'Total number of cache hits',
        })
      );
    });

    it('should configure cacheMisses counter', () => {
      expect(Counter).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'cache_misses_total',
          help: 'Total number of cache misses',
        })
      );
    });

    it('should configure cacheOperationDuration histogram', () => {
      expect(Histogram).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'cache_operation_duration_seconds',
          help: 'Cache operation duration in seconds',
          labelNames: ['operation'],
          buckets: [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1],
        })
      );
    });
  });

  describe('Auth metrics configuration', () => {
    it('should configure authAttemptsTotal counter', () => {
      expect(Counter).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'auth_attempts_total',
          help: 'Total number of authentication attempts',
          labelNames: ['method'],
        })
      );
    });

    it('should configure authSuccessTotal counter', () => {
      expect(Counter).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'auth_success_total',
          help: 'Total number of successful authentications',
          labelNames: ['method'],
        })
      );
    });

    it('should configure authFailuresTotal counter', () => {
      expect(Counter).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'auth_failures_total',
          help: 'Total number of failed authentications',
          labelNames: ['method', 'reason'],
        })
      );
    });
  });

  describe('TCP metrics configuration', () => {
    it('should configure tcpConnectionsTotal counter', () => {
      expect(Counter).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'tcp_connections_total',
          help: 'Total number of TCP connections',
          labelNames: ['status'],
        })
      );
    });

    it('should configure tcpConnectionsActive gauge', () => {
      expect(Gauge).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'tcp_connections_active',
          help: 'Number of active TCP connections',
        })
      );
    });

    it('should configure tcpMessagesReceived counter', () => {
      expect(Counter).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'tcp_messages_received_total',
          help: 'Total number of TCP messages received',
          labelNames: ['type'],
        })
      );
    });

    it('should configure tcpMessagesSent counter', () => {
      expect(Counter).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'tcp_messages_sent_total',
          help: 'Total number of TCP messages sent',
          labelNames: ['type'],
        })
      );
    });

    it('should configure tcpBytesReceived counter', () => {
      expect(Counter).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'tcp_bytes_received_total',
          help: 'Total bytes received over TCP',
        })
      );
    });

    it('should configure tcpBytesSent counter', () => {
      expect(Counter).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'tcp_bytes_sent_total',
          help: 'Total bytes sent over TCP',
        })
      );
    });

    it('should configure tcpFramesParsed counter', () => {
      expect(Counter).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'tcp_frames_parsed_total',
          help: 'Total number of TCP frames successfully parsed',
        })
      );
    });

    it('should configure tcpFrameErrors counter', () => {
      expect(Counter).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'tcp_frame_errors_total',
          help: 'Total number of TCP frame parsing errors',
          labelNames: ['error_type'],
        })
      );
    });

    it('should configure tcpMessageDuration histogram', () => {
      expect(Histogram).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'tcp_message_duration_seconds',
          help: 'TCP message processing duration in seconds',
          labelNames: ['type'],
          buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
        })
      );
    });
  });

  describe('getMetrics()', () => {
    it('should return metrics in Prometheus format', async () => {
      const metrics = await testMetricsService.getMetrics();

      expect(metrics).toBeDefined();
      expect(typeof metrics).toBe('string');
      expect(testMetricsService.registry.metrics).toHaveBeenCalled();
    });

    it('should return Prometheus text format', async () => {
      const metrics = await testMetricsService.getMetrics();

      expect(metrics).toContain('# Mock metrics');
      expect(metrics).toContain('metric_name');
    });
  });

  describe('getMetricsJSON()', () => {
    it('should return metrics as JSON', async () => {
      const metrics = await testMetricsService.getMetricsJSON();

      expect(metrics).toBeDefined();
      expect(testMetricsService.registry.getMetricsAsJSON).toHaveBeenCalled();
    });

    it('should return array of metric objects', async () => {
      const metrics = await testMetricsService.getMetricsJSON();

      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics).toEqual([{ name: 'mock_metric', value: 1.0 }]);
    });
  });

  describe('clear()', () => {
    it('should clear all metrics from registry', () => {
      testMetricsService.clear();

      expect(testMetricsService.registry.clear).toHaveBeenCalled();
    });
  });

  describe('Metric types', () => {
    it('should expose Counter methods on counter metrics', () => {
      expect(testMetricsService.httpRequestsTotal.inc).toBeInstanceOf(Function);
      expect(testMetricsService.cacheHits.inc).toBeInstanceOf(Function);
      expect(testMetricsService.databaseQueriesTotal.inc).toBeInstanceOf(Function);
    });

    it('should expose Histogram methods on histogram metrics', () => {
      expect(testMetricsService.httpRequestDuration.observe).toBeInstanceOf(Function);
      expect(testMetricsService.cacheOperationDuration.observe).toBeInstanceOf(Function);
      expect(testMetricsService.databaseQueryDuration.observe).toBeInstanceOf(Function);
    });

    it('should expose Gauge methods on gauge metrics', () => {
      expect(testMetricsService.activeConnections.inc).toBeInstanceOf(Function);
      expect(testMetricsService.activeConnections.dec).toBeInstanceOf(Function);
      expect(testMetricsService.activeConnections.set).toBeInstanceOf(Function);
    });
  });

  describe('Singleton export', () => {
    it('should export metricsService singleton', () => {
      expect(metricsService).toBeDefined();
      expect(metricsService).toBeInstanceOf(MetricsService);
    });
  });

  describe('Registry integration', () => {
    it('should register all metrics with the registry', () => {
      // All metrics should be created with registers: [this.registry]
      const counterCalls = vi.mocked(Counter).mock.calls;
      counterCalls.forEach((call) => {
        expect(call[0]).toHaveProperty('registers');
        expect(Array.isArray(call[0].registers)).toBe(true);
      });

      const histogramCalls = vi.mocked(Histogram).mock.calls;
      histogramCalls.forEach((call) => {
        expect(call[0]).toHaveProperty('registers');
        expect(Array.isArray(call[0].registers)).toBe(true);
      });

      const gaugeCalls = vi.mocked(Gauge).mock.calls;
      gaugeCalls.forEach((call) => {
        expect(call[0]).toHaveProperty('registers');
        expect(Array.isArray(call[0].registers)).toBe(true);
      });
    });
  });

  describe('Metric counts', () => {
    it('should create expected number of Counter metrics', () => {
      // Count: httpRequestsTotal, eventsEmitted, eventsHandled, databaseQueriesTotal,
      // cacheHits, cacheMisses, authAttemptsTotal, authSuccessTotal, authFailuresTotal,
      // tcpConnectionsTotal, tcpMessagesReceived, tcpMessagesSent, tcpBytesReceived,
      // tcpBytesSent, tcpFramesParsed, tcpFrameErrors = 16 counters
      expect(Counter).toHaveBeenCalledTimes(16);
    });

    it('should create expected number of Histogram metrics', () => {
      // Count: httpRequestDuration, httpRequestSize, httpResponseSize,
      // databaseQueryDuration, cacheOperationDuration, tcpMessageDuration = 6 histograms
      expect(Histogram).toHaveBeenCalledTimes(6);
    });

    it('should create expected number of Gauge metrics', () => {
      // Count: activeConnections, databaseConnectionsActive, tcpConnectionsActive = 3 gauges
      expect(Gauge).toHaveBeenCalledTimes(3);
    });
  });
});

/**
 * GraphQL Metrics Plugin - Prometheus metrics collection
 * Layer 4: Application
 *
 * Collects metrics for GraphQL operations:
 * - Operation counts by type (query, mutation, subscription)
 * - Operation duration
 * - Error counts
 */

import { Plugin } from 'graphql-yoga';
import { Counter, Histogram } from 'prom-client';
import { logger } from '@infrastructure/logging/logger';

// Metrics
const graphqlOperationsTotal = new Counter({
  name: 'graphql_operations_total',
  help: 'Total number of GraphQL operations',
  labelNames: ['operation_type', 'operation_name', 'status'],
});

const graphqlOperationDuration = new Histogram({
  name: 'graphql_operation_duration_seconds',
  help: 'GraphQL operation duration in seconds',
  labelNames: ['operation_type', 'operation_name'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
});

const graphqlErrorsTotal = new Counter({
  name: 'graphql_errors_total',
  help: 'Total number of GraphQL errors',
  labelNames: ['operation_type', 'operation_name', 'error_code'],
});

// Reserved for future use - field-level metrics
// const graphqlFieldResolutionsTotal = new Counter({
//   name: 'graphql_field_resolutions_total',
//   help: 'Total number of GraphQL field resolutions',
//   labelNames: ['parent_type', 'field_name', 'status'],
// });

/**
 * Metrics collection plugin
 */
export function createMetricsPlugin(): Plugin {
  return {
    onExecute({ args }) {
      const startTime = Date.now();
      const operationType = args.operationName || 'anonymous';
      const operation = args.document?.definitions?.[0];
      const operationKind = (operation as any)?.operation || 'unknown';

      return {
        onExecuteDone({ result }) {
          const duration = (Date.now() - startTime) / 1000;

          // Record duration
          graphqlOperationDuration
            .labels(operationKind, operationType)
            .observe(duration);

          // Check if result is a direct ExecutionResult (not AsyncIterator)
          const isError = Symbol.asyncIterator in result
            ? false
            : 'errors' in result && result.errors && result.errors.length > 0;

          // Record operation count
          const status = isError ? 'error' : 'success';
          graphqlOperationsTotal
            .labels(operationKind, operationType, status)
            .inc();

          // Record errors if this is a direct result
          if (!(Symbol.asyncIterator in result) && 'errors' in result && result.errors) {
            const errors = result.errors as any[];
            errors.forEach((error: any) => {
              const errorCode = (error.extensions?.code as string) || 'UNKNOWN';
              graphqlErrorsTotal
                .labels(operationKind, operationType, errorCode)
                .inc();
            });

            logger.warn(
              {
                operationType,
                operationKind,
                errorCount: errors.length,
                duration,
              },
              'GraphQL operation completed with errors'
            );
          } else {
            logger.debug(
              {
                operationType,
                operationKind,
                duration,
              },
              'GraphQL operation completed successfully'
            );
          }
        },
      };
    },
  };
}

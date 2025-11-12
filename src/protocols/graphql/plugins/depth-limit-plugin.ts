/**
 * Query Depth Limit Plugin - Prevents deeply nested queries
 * Layer 4: Application
 *
 * Enforces maximum query depth to prevent recursive query attacks
 */

import { Plugin } from 'graphql-yoga';
// @ts-ignore - No type definitions available
import depthLimit from 'graphql-depth-limit';
import { logger } from '@infrastructure/logging/logger';
import { config } from '@infrastructure/config/config-loader';

/**
 * Depth limiting plugin
 * Rejects queries that exceed depth limits
 */
export function createDepthLimitPlugin(): Plugin {
  const maxDepth = config.graphql?.complexity?.maxDepth || 5;

  logger.info({ maxDepth }, 'GraphQL depth limit configured');

  return {
    onValidate({ addValidationRule }) {
      // Add depth limit validation rule
      addValidationRule(
        depthLimit(maxDepth, {
          ignore: [
            // Ignore depth counting for these fields (common patterns)
            'pageInfo', // Pagination info
            'edges',    // Connection edges
            'node',     // Connection nodes
          ],
        })
      );
    },
  };
}

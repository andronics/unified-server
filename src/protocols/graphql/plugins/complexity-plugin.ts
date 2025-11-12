/**
 * Query Complexity Plugin - Prevents expensive GraphQL queries
 * Layer 4: Application
 *
 * Calculates query complexity and enforces limits to prevent DoS attacks
 */

import { Plugin } from 'graphql-yoga';
import {
  getComplexity,
  simpleEstimator,
  fieldExtensionsEstimator,
} from 'graphql-query-complexity';
import { GraphQLError } from 'graphql';
import { logger } from '@infrastructure/logging/logger';
import { config } from '@infrastructure/config/config-loader';

/**
 * Complexity calculation plugin
 * Rejects queries that exceed complexity limits
 */
export function createComplexityPlugin(): Plugin {
  const maxComplexity = config.graphql?.complexity?.maxComplexity || 1000;

  return {
    onValidate({ params, addValidationRule }) {
      const { schema, documentAST } = params;

      if (!documentAST) {
        return;
      }

      // Add complexity validation rule
      addValidationRule((_context: any) => ({
        Document: {
          leave(node: any) {
            try {
              const complexity = getComplexity({
                schema,
                query: node,
                variables: {},
                estimators: [
                  // Custom field cost estimator (respects @cost directive)
                  fieldExtensionsEstimator(),
                  // Simple estimator (1 point per field)
                  simpleEstimator({ defaultComplexity: 1 }),
                ],
              });

              logger.debug(
                {
                  complexity,
                  maxComplexity,
                },
                'GraphQL query complexity calculated'
              );

              if (complexity > maxComplexity) {
                logger.warn(
                  {
                    complexity,
                    maxComplexity,
                  },
                  'GraphQL query complexity limit exceeded'
                );

                throw new GraphQLError(
                  `Query complexity limit exceeded: ${complexity} > ${maxComplexity}`,
                  {
                    extensions: {
                      code: 'QUERY_COMPLEXITY_LIMIT_EXCEEDED',
                      complexity,
                      maxComplexity,
                    },
                  }
                );
              }
            } catch (error) {
              if (error instanceof GraphQLError) {
                throw error;
              }

              logger.error(
                { error },
                'Error calculating query complexity'
              );
            }
          },
        },
      }));
    },
  };
}

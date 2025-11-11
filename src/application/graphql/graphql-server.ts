/**
 * GraphQL Server Setup
 * Layer 4: Application
 *
 * Configures and creates the GraphQL Yoga server instance
 */

import { createYoga } from 'graphql-yoga';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { typeDefs } from './schema';
import { resolvers } from './resolvers';
import { buildGraphQLContext } from './context';
import { logger } from '@infrastructure/logging/logger';
import { config } from '@infrastructure/config/config-loader';

/**
 * Create GraphQL schema with type definitions and resolvers
 */
function createGraphQLSchema() {
  return makeExecutableSchema({
    typeDefs,
    resolvers,
  });
}

/**
 * Create and configure GraphQL Yoga server
 */
export function createGraphQLServer() {
  const schema = createGraphQLSchema();

  const yoga = createYoga({
    schema,
    context: async (ctx) => {
      // When running in Express, use req (Express Request)
      // When running standalone, use request (Fetch API Request)
      const req = (ctx as any).req || ctx.request;
      return buildGraphQLContext(req);
    },
    graphiql: config.graphql?.playground?.enabled ?? true,
    logging: {
      debug: (...args) => logger.debug({ args }, 'GraphQL debug'),
      info: (...args) => logger.info({ args }, 'GraphQL info'),
      warn: (...args) => logger.warn({ args }, 'GraphQL warn'),
      error: (...args) => logger.error({ args }, 'GraphQL error'),
    },
    landingPage: false, // Disable default landing page, use GraphiQL
  });

  logger.info(
    {
      path: config.graphql?.path ?? '/graphql',
      playground: config.graphql?.playground?.enabled ?? true,
    },
    'GraphQL server created'
  );

  return yoga;
}

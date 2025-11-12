/**
 * GraphQL Resolvers Index
 * Layer 4: Application
 *
 * Combines all resolvers into a single resolver map
 */

import { queryResolvers } from './query-resolvers';
import { mutationResolvers } from './mutation-resolvers';
import { messageFieldResolvers } from './field-resolvers';
import { subscriptionResolvers } from './subscription-resolvers';

/**
 * Combined GraphQL resolvers
 */
export const resolvers = {
  Query: queryResolvers,
  Mutation: mutationResolvers,
  Subscription: subscriptionResolvers,

  // Field resolvers
  Message: messageFieldResolvers,

  // DateTime scalar
  DateTime: {
    serialize: (value: Date) => value.toISOString(),
    parseValue: (value: string) => new Date(value),
    parseLiteral: (ast: any) => {
      if (ast.kind === 'StringValue') {
        return new Date(ast.value);
      }
      return null;
    },
  },
};

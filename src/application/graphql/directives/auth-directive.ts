/**
 * @auth Directive - Enforces authentication on GraphQL fields
 * Layer 4: Application
 *
 * Usage: Add @auth to any field or type that requires authentication
 * Example: me: User @auth
 */

import { getDirective, MapperKind, mapSchema } from '@graphql-tools/utils';
import { GraphQLSchema, defaultFieldResolver, GraphQLFieldConfig } from 'graphql';
import { ApiError } from '@foundation/errors/api-error';
import { GraphQLContext } from '@foundation/types/graphql-types';
import { logger } from '@infrastructure/logging/logger';

/**
 * Auth directive transformer
 * Wraps field resolvers to check authentication
 */
export function authDirectiveTransformer(schema: GraphQLSchema, directiveName: string) {
  return mapSchema(schema, {
    // Check object fields (Query.me, Mutation.updateUser, etc.)
    [MapperKind.OBJECT_FIELD]: (fieldConfig: GraphQLFieldConfig<any, any>) => {
      // Check if field has @auth directive
      const authDirective = getDirective(schema, fieldConfig, directiveName)?.[0];

      if (authDirective) {
        const { resolve = defaultFieldResolver } = fieldConfig;

        // Wrap resolver with authentication check
        fieldConfig.resolve = async (source, args, context: GraphQLContext, info) => {
          // Check if user is authenticated
          if (!context.user) {
            logger.warn(
              {
                field: info.fieldName,
                correlationId: context.correlationId,
              },
              'Unauthorized GraphQL field access attempt'
            );

            throw ApiError.unauthorized(
              `Authentication required to access field: ${info.fieldName}`
            );
          }

          logger.debug(
            {
              field: info.fieldName,
              userId: context.user.id,
              correlationId: context.correlationId,
            },
            'Authenticated GraphQL field access'
          );

          // Call original resolver
          return resolve(source, args, context, info);
        };

        return fieldConfig;
      }

      return fieldConfig;
    },
  });
}

/**
 * Auth directive type definition for schema
 */
export const authDirectiveTypeDefs = `
  """
  Requires authentication to access this field.
  An unauthorized request will return an error.
  """
  directive @auth on FIELD_DEFINITION | OBJECT
`;

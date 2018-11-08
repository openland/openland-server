import { merge } from 'lodash';
import { makeExecutableSchema } from 'graphql-tools';
import * as Basics from './Date';

import { Directives, IDScalars, injectIDScalars } from './Directives2';
import { GraphQLField, GraphQLFieldResolver } from 'graphql';
import { wrapAllResolvers } from '../Resolvers';
import { withLogContext } from '../../openland-log/withLogContext';
import { trace } from 'openland-log/trace';
import { gqlTracer } from 'openland-graphql/gqlTracer';
import { buildSchema } from 'openland-graphql/buildSchema';
import { buildResolvers } from 'openland-graphql/buildResolvers';
import { withTracingSpan } from 'openland-log/withTracing';
import { withCache } from 'foundation-orm/withCache';

let schema = buildSchema(__dirname + '/../../');
let resolvers = buildResolvers(__dirname + '/../../');

export const Schema = wrapAllResolvers(
    makeExecutableSchema({
        typeDefs: injectIDScalars(schema),
        resolvers: merge(
            Basics.Resolvers,
            IDScalars,
            ...resolvers
        ),
        schemaDirectives: Directives
    }),
    async (
        field: GraphQLField<any, any>,
        originalResolver: GraphQLFieldResolver<any, any, any>,
        root: any,
        args: any,
        context: any,
        info: any
    ) => {
        if (context.span) {
            return await withTracingSpan(context.span, async () => {
                return await trace(gqlTracer, field.name, async () => {
                    return await withLogContext(field.name, async () => {
                        return await withCache(async () => {
                            return await originalResolver(root, args, context, info);
                        });
                    });
                });
            });
        } else {
            return await trace(gqlTracer, field.name, async () => {
                return await withLogContext(field.name, async () => {
                    return await withCache(async () => {
                        return await originalResolver(root, args, context, info);
                    });
                });
            });
        }
    }
);

import { merge } from 'lodash';
import { makeExecutableSchema } from 'graphql-tools';
import * as User from './User';
import * as Basics from './_Basics';
import * as Permissions from './Permissions';
import * as Account from './Account';
import * as Organization from './Organization';
import * as Chat from './Chat';
import * as Channels from './Channels';

import { Directives, IDScalars } from './directives';
import { GraphQLField, GraphQLFieldResolver } from 'graphql';
import { wrapAllResolvers } from './utils/Resolvers';
import { withLogContext } from '../../openland-log/withLogContext';
import { trace } from 'openland-log/trace';
import { gqlTracer } from 'openland-server/utils/gqlTracer';
import { buildSchema } from 'openland-graphql/buildSchema';
import { buildResolvers } from 'openland-graphql/buildResolvers';
import { withTracingSpan } from 'openland-log/withTracing';

let schema = buildSchema(__dirname + '/../../');
let resolvers = buildResolvers(__dirname + '/../../');

export const Schema = wrapAllResolvers(
    makeExecutableSchema({
        typeDefs: schema,
        resolvers: merge(
            Basics.Resolvers,
            Account.Resolver,
            User.Resolver,
            Permissions.Resolvers,
            Organization.Resolver,
            Chat.Resolver,
            Channels.Resolver,
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
                        return await originalResolver(root, args, context, info);
                    });
                });
            });
        } else {
            return await trace(gqlTracer, field.name, async () => {
                return await withLogContext(field.name, async () => {
                    return await originalResolver(root, args, context, info);
                });
            });
        }
    }
);

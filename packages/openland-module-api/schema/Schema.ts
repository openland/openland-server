import { makeExecutableSchema } from 'graphql-tools';
import * as Basics from './Date';

import { Directives } from './Directives2';
import { GraphQLField, GraphQLFieldResolver, GraphQLObjectType, GraphQLResolveInfo } from 'graphql';
import { wrapAllResolvers } from '../Resolvers';
import { buildSchema } from 'openland-graphql/buildSchema';
import { buildResolvers } from 'openland-graphql/buildResolvers';
import { AppContext, GQLAppContext } from 'openland-modules/AppContext';
import { merge } from '../../openland-utils/merge';
import { withLogPath } from '@openland/log';
import { gqlTraceNamespace } from '../../openland-graphql/gqlTracer';
import { createHyperlogger } from '../../openland-module-hyperlog/createHyperlogEvent';

const onGqlQuery = createHyperlogger<{ type: string, field: string }>('gql_query');

export const Schema = (forTest: boolean = false) => {
    let schema = buildSchema(__dirname + '/../../');
    let resolvers = buildResolvers(__dirname + '/../../', forTest);

    let executableSchema = makeExecutableSchema({
        typeDefs: schema,
        resolvers: merge(
            Basics.Resolvers,
            ...resolvers
        ),
        schemaDirectives: Directives
    });

    if (forTest) {
        return executableSchema;
    }

    return wrapAllResolvers(executableSchema,
        async (
            type: GraphQLObjectType,
            field: GraphQLField<any, any>,
            originalResolver: GraphQLFieldResolver<any, any, any>,
            root: any,
            args: any,
            context: any,
            info: GraphQLResolveInfo
        ) => {
            if (type.name === 'Query') {
                await onGqlQuery.event(context, { type: 'Query', field: field.name });
            } else if (type.name === 'Mutation') {
                await onGqlQuery.event(context, { type: 'Mutation', field: field.name });
            } else if (type.name === 'Subscription') {
                await onGqlQuery.event(context, { type: 'Subscription', field: field.name });
            }

            let ctx = (context as AppContext).ctx;
            let trace = gqlTraceNamespace.get(ctx);
            let path: (string|number)[] = [];
            try {
                let current = info.path;
                path.unshift(current.key);
                while (current.prev) {
                    current = current.prev;
                    path.unshift(current.key);
                }
            } catch {
                //
            }

            let ctx3 = withLogPath(ctx, path.join('->'));
            if (trace) {
                trace.onResolveStart(path);
                try {
                    return await originalResolver(root, args, new GQLAppContext(ctx3, info), info);
                } finally {
                    trace.onResolveEnd(path);
                }
            }

            return await originalResolver(root, args, new GQLAppContext(ctx3, info), info);
        }
    );
};
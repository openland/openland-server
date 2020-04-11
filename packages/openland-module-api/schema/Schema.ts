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

export function fetchResolvePath(info: GraphQLResolveInfo) {
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
    return path;
}
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
            let path = fetchResolvePath(info);
            let ctx = (context as AppContext).ctx;
            let ctx2 = withLogPath(ctx, path.join('->'));
            // let name = 'Field:' + field.name;
            // if (type.name === 'Query') {
            //     name = 'Query:' + field.name;
            // } else if (type.name === 'Mutation') {
            //     name = 'Mutation:' + field.name;
            // } else if (type.name === 'Subscription') {
            //     name = 'Subscription:' + field.name;
            // }
            let trace = gqlTraceNamespace.get(ctx);
            if (trace) {
                let t = trace.onResolve(info);
                try {
                    return await originalResolver(root, args, new GQLAppContext(ctx2, info), info);
                } finally {
                    t();
                }
            }
            return await originalResolver(root, args, new GQLAppContext(ctx2, info), info);
        }
    );
};

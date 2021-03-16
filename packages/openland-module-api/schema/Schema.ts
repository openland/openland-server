import { makeExecutableSchema } from 'graphql-tools';
import * as Basics from './Date';
import { Directives } from './Directives2';
import { GraphQLResolveInfo } from 'graphql';
import { buildSchema } from 'openland-graphql/buildSchema';
import { buildResolvers } from 'openland-graphql/buildResolvers';
import { merge } from '../../openland-utils/merge';
import { withLogPath } from '@openland/log';
import { instrumentSchema } from 'openland-graphql/instrumentResolvers';
import { createTracer } from 'openland-log/createTracer';
import { TracingContext } from 'openland-log/src/TracingContext';
import { isPromise } from 'openland-utils/isPromise';

const tracer = createTracer('gql');

function fetchResolvePath(info: GraphQLResolveInfo) {
    let path: (string | number)[] = [];
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

    instrumentSchema(executableSchema, {
        field: (type, field, original, root, args, context, info) => {
            let path = fetchResolvePath(info);
            let ctx = context;
            ctx = withLogPath(ctx, path.join('->'));

            // Tracing
            let c = TracingContext.get(ctx);
            let span = tracer.startSpan(type.name + '.' + field.name, c.span ? c.span : undefined);
            ctx = TracingContext.set(ctx, { span });

            // Original
            let res: any;
            try {
                res = original(root, args, ctx, info);
            } catch (e) {
                span.finish();
                throw e;
            }

            if (isPromise(res)) {
                res.finally(() => {
                    span.finish();
                }).catch(() => {
                    span.finish();
                });
            } else {
                span.finish();
            }
            return res;
        }
    });

    return executableSchema;

    // return wrapAllResolvers(executableSchema,
    //     async (
    //         type: GraphQLObjectType,
    //         field: GraphQLField<any, any>,
    //         originalResolver: GraphQLFieldResolver<any, any, any>,
    //         root: any,
    //         args: any,
    //         context: any,
    //         info: GraphQLResolveInfo
    //     ) => {
    //         let path = fetchResolvePath(info);
    //         let ctx = context;
    //         let ctx2 = withLogPath(ctx, path.join('->'));
    //         // let name = 'Field:' + field.name;
    //         // if (type.name === 'Query') {
    //         //     name = 'Query:' + field.name;
    //         // } else if (type.name === 'Mutation') {
    //         //     name = 'Mutation:' + field.name;
    //         // } else if (type.name === 'Subscription') {
    //         //     name = 'Subscription:' + field.name;
    //         // }
    //         return await originalResolver(root, args, ctx2, info);
    //     }
    // );
};

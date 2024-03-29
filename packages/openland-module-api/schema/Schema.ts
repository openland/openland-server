import { makeExecutableSchema } from 'graphql-tools';
import { Directives } from './Directives2';
import { GraphQLResolveInfo } from 'graphql';
import { buildSchema } from 'openland-graphql/buildSchema';
import { buildResolvers } from 'openland-graphql/buildResolvers';
import { withLogPath } from '@openland/log';
import { instrumentSchema } from 'openland-graphql/instrumentResolvers';
import { createTracer } from 'openland-log/createTracer';
import { TracingContext } from 'openland-log/src/TracingContext';
import { isPromise } from 'openland-utils/isPromise';
import { Config } from 'openland-config/Config';

const tracer = createTracer('gql');

const ENABLE_LOG_PATH = false;

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
        resolvers: resolvers.resolvers,
        schemaDirectives: Directives
    });

    if (forTest) {
        return executableSchema;
    }

    instrumentSchema(executableSchema, {
        object: (type, value, context) => {
            if (resolvers.rootResolvers[type.name]) {
                let c = TracingContext.get(context);
                let span = tracer.startSpan(type + '.__resolveObject', c.span ? c.span : undefined);
                let ctx = TracingContext.set(context, { span });
                let res: any;
                try {
                    res = resolvers.rootResolvers[type.name](value, ctx);
                } catch (e) {
                    span.finish();
                    throw e;
                }
                if (isPromise(res)) {
                    return res.finally(() => {
                        span.finish();
                    });
                } else {
                    span.finish();
                    return res;
                }
            }
            return value;
        },
        field: (type, field, original, root, args, context, info) => {
            let ctx = context;

            // Enable log path
            if (ENABLE_LOG_PATH) {
                let path = fetchResolvePath(info);
                ctx = withLogPath(ctx, path.join('->'));
            }

            // Enable tracing if needed
            if (!Config.enableTracing || !Config.enableGraphqlTracing) {
                return original(root, args, ctx, info);
            }

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
                return res.finally(() => {
                    span.finish();
                });
            } else {
                span.finish();
                return res;
            }
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

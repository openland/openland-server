import { makeExecutableSchema } from 'graphql-tools';
import { Directives } from './Directives2';
import { GraphQLResolveInfo } from 'graphql';
// import { GraphQLEnumType, GraphQLInterfaceType, GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLOutputType, GraphQLScalarType, GraphQLUnionType } from 'graphql';
import { buildSchema } from 'openland-graphql/buildSchema';
import { buildResolvers } from 'openland-graphql/buildResolvers';
import { withLogPath } from '@openland/log';
import { instrumentSchema } from 'openland-graphql/instrumentResolvers';
import { createTracer } from 'openland-log/createTracer';
import { TracingContext } from 'openland-log/src/TracingContext';
import { isPromise } from 'openland-utils/isPromise';
// import { Context } from '@openland/context';

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
        resolvers: resolvers.resolvers,
        schemaDirectives: Directives
    });

    if (forTest) {
        return executableSchema;
    }

    // function resolveObjectValue(type: string, value: any, ctx: Context, info: any) {
    //     if (resolvers.rootResolvers[type]) {
    //         let c = TracingContext.get(ctx);
    //         let span = tracer.startSpan(type + '.__resolveObject', c.span ? c.span : undefined);
    //         ctx = TracingContext.set(ctx, { span });
    //         let res: any;
    //         try {
    //             res = resolvers.rootResolvers[type](value, ctx);
    //         } catch (e) {
    //             span.finish();
    //             throw e;
    //         }
    //         if (isPromise(res)) {
    //             return res.finally(() => {
    //                 span.finish();
    //             });
    //         } else {
    //             span.finish();
    //             return res;
    //         }
    //     }
    //     return value;
    // }

    // function resolveObject(type: GraphQLOutputType, value: any, context: Context, info: any): any {

    //     // Nullable values
    //     // NOTE: We are handling nullability checks in executor
    //     if (value === null || value === undefined) {
    //         return value;
    //     }

    //     // Handle promise
    //     if (isPromise(value)) {
    //         return value.then((v) => resolveObject(type, v, context, info));
    //     }

    //     // Unwrap non-null
    //     if (type instanceof GraphQLNonNull) {
    //         return resolveObject(type.ofType, value, context, info);
    //     }

    //     // Scalar
    //     if (type instanceof GraphQLScalarType) {
    //         return value;
    //     }

    //     // Enum
    //     if (type instanceof GraphQLEnumType) {
    //         return value;
    //     }

    //     // List
    //     if (type instanceof GraphQLList) {
    //         let res: any[] = [];
    //         let hasPromise = false;
    //         for (let item of value) {
    //             let resolved = resolveObject(type.ofType, item, context, info);
    //             if (isPromise(resolved)) {
    //                 hasPromise = true;
    //             }
    //             res.push(resolved);
    //         }
    //         if (hasPromise) {
    //             return Promise.all(res);
    //         } else {
    //             return res;
    //         }
    //     }

    //     // Abstract types
    //     if (type instanceof GraphQLUnionType || type instanceof GraphQLInterfaceType) {
    //         const resolvedType = type.resolveType!(value, context, info, type);
    //         if (isPromise(resolvedType)) {
    //             return resolvedType.then((v) => resolveObjectValue(typeof v === 'string' ? v : v!.name, value, context, info));
    //         }
    //         return resolveObjectValue(typeof resolvedType === 'string' ? resolvedType : resolvedType!.name, value, context, info);
    //     }

    //     // Object type
    //     if (type instanceof GraphQLObjectType) {
    //         return resolveObjectValue(type.name, value, context, info);
    //     }

    //     // Invalid
    //     throw Error('Invalid object type');
    // }

    instrumentSchema(executableSchema, {
        // object: (type, value, context, info) => {
        //     // return resolveObject(type, value, context, info);
        // },
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

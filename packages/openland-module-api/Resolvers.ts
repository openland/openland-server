import { AccessDeniedError } from '../openland-errors/AccessDeniedError';
import { ErrorText } from '../openland-errors/ErrorText';
import { GraphQLField, GraphQLFieldResolver, GraphQLObjectType, GraphQLSchema } from 'graphql';
import { Store } from 'openland-module-db/FDB';
import { Modules } from 'openland-modules/Modules';
import { MaybePromise } from './schema/SchemaUtils';
import { CacheContext } from './CacheContext';
import { createNamedContext, Context } from '@openland/context';
import { inTx } from '@openland/foundationdb';

async function fetchPermissions(ctx: Context) {
    if (ctx.cache.has('permissions')) {
        return (await ctx.cache.get('permissions')) as Set<string>;
    }
    let res = await inTx(ctx, (ctx2) => Modules.Super.resolvePermissions(ctx2, { uid: ctx.auth.uid }));
    ctx.cache.set('permissions', res);
    return res;
}

export function withPermission<T, R, F>(permission: string | string[], resolver: (ctx: Context, args: T, root: F) => Promise<R>): (root: F, args: T, ctx: Context) => MaybePromise<R> {
    return async function (root: F, args: T, ctx: Context) {
        let permissions = await fetchPermissions(ctx);
        if (Array.isArray(permission)) {
            for (let p of permission) {
                if (permissions.has(p)) {
                    return await resolver(ctx, args, root);
                }
            }
        } else if (permissions.has(permission)) {
            return await resolver(ctx, args, root);
        } else {
            throw new AccessDeniedError(ErrorText.permissionDenied);
        }
        throw new AccessDeniedError(ErrorText.permissionDenied);
    };
}

export function withAccount<T, R>(resolver: (ctx: Context, args: T, uid: number) => Promise<R>): (_: any, args: T, ctx: Context) => MaybePromise<R> {
    return async function (_: any, args: T, ctx: Context) {
        if (!ctx.auth.uid) {
            throw new AccessDeniedError(ErrorText.permissionDenied);
        }
        return await resolver(ctx, args, ctx.auth.uid);
    };
}

export function withActivatedUser<T, R, P>(resolver: (ctx: Context, args: T, uid: number, parent: P) => Promise<R>): (parent: P, args: T, ctx: Context) => MaybePromise<R> {
    return async function (parent: P, args: T, ctx: Context) {
        if (!ctx.auth.uid) {
            throw new AccessDeniedError(ErrorText.permissionDenied);
        }
        let user = await Store.User.findById(ctx, ctx.auth.uid);
        if (!user || user.status !== 'activated') {
            throw new AccessDeniedError(ErrorText.permissionDenied);
        }
        return await resolver(ctx, args, ctx.auth.uid, parent);
    };
}

export function withUser<T, R>(resolver: (ctx: Context, args: T, uid: number) => Promise<R>): (_: any, args: T, ctx: Context) => MaybePromise<R> {
    return async function (_: any, args: T, ctx: Context) {
        if (!ctx.auth.uid) {
            throw new AccessDeniedError(ErrorText.permissionDenied);
        }
        return await resolver(ctx, args, ctx.auth.uid);
    };
}

export function withAny<T, R>(resolver: (ctx: Context, args: T) => Promise<R>): (_: any, args: T, ctx: Context) => MaybePromise<R> {
    return async (_: any, args: T, ctx: Context) => {
        return await resolver(ctx, args);
    };
}

export function resolveUser<T extends { userId: number }>() {
    return async function (src: T, args: T, ctx: Context) {
        return (await Store.User.findById(ctx, src.userId))!;
    };
}

type BasicResolver<Root, Args, Res> = (root: Root, args: Args, ctx: Context) =>  MaybePromise<Res>;
export function withAuthFallback<Root, Args, Res, Fallback>(resolver: BasicResolver<Root, Args, Res>, fallback: Res): BasicResolver<Root, Args, Res> {
    return async function (src: Root, args: Args, ctx: Context) {
        if (!ctx.auth.uid) {
            return fallback;
        }
        return resolver(src, args, ctx);
    };
}

type FieldHandler = (type: GraphQLObjectType, field: GraphQLField<any, any>, originalResolver: GraphQLFieldResolver<any, any, any>, root: any, args: any, context: any, info: any) => any;
const defaultContext = createNamedContext('default-resolver');
export function wrapAllResolvers(schema: GraphQLSchema, handler: FieldHandler) {
    let types = schema.getTypeMap();

    for (let typeName in types) {
        if (!Object.hasOwnProperty.call(types, typeName)) {
            continue;
        }

        let type = types[typeName];

        if (type instanceof GraphQLObjectType && !type.name.startsWith('__')) {
            let fields = type.getFields();

            for (let fieldName in fields) {
                if (!Object.hasOwnProperty.call(fields, fieldName)) {
                    continue;
                }

                let field = fields[fieldName];

                let fieldResolve = field.resolve;
                if (field.resolve) {
                    field.resolve = async (root: any, args: any, context: Context, info: any) => {
                        if (!context) {
                            let res = defaultContext;
                            context = CacheContext.set(res, new Map());
                        }
                        return await handler(type as GraphQLObjectType, field, fieldResolve!, root, args, context, info);
                    };
                }
            }
        }
    }
    return schema;
}

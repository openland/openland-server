import { AccessDeniedError } from '../openland-errors/AccessDeniedError';
import { ErrorText } from '../openland-errors/ErrorText';
import { GraphQLField, GraphQLFieldResolver, GraphQLObjectType, GraphQLSchema } from 'graphql';
import { FDB } from 'openland-module-db/FDB';
import { Modules } from 'openland-modules/Modules';
import { AppContext, GQLAppContext } from 'openland-modules/AppContext';
import { MaybePromise } from './schema/SchemaUtils';
import { CacheContext } from './CacheContext';
import { createNamedContext } from '@openland/context';
import { inTx } from '@openland/foundationdb';

async function fetchPermissions(ctx: AppContext) {
    if (ctx.cache.has('permissions')) {
        return (await ctx.cache.get('permissions')) as Set<string>;
    }
    let res = await inTx(ctx, (ctx2) => Modules.Super.resolvePermissions(ctx2, { uid: ctx.auth.uid, oid: ctx.auth.oid }));
    ctx.cache.set('permissions', res);
    return await res;
}

async function fetchOrganizationId(ctx: AppContext) {
    return ctx.auth.oid;
}

export function withPermission<T, R>(permission: string | string[], resolver: (ctx: AppContext, args: T) => R): (_: any, args: T, ctx: AppContext) => MaybePromise<R> {
    return async function (_: any, args: T, ctx: AppContext) {
        let permissions = await fetchPermissions(ctx);
        if (Array.isArray(permission)) {
            for (let p of permission) {
                if (permissions.has(p)) {
                    return resolver(ctx, args);
                }
            }
        } else if (permissions.has(permission)) {
            return resolver(ctx, args);
        } else {
            throw new AccessDeniedError(ErrorText.permissionDenied);
        }
        throw new AccessDeniedError(ErrorText.permissionDenied);
    };
}

export function withAccount<T, R>(resolver: (ctx: AppContext, args: T, uid: number, org: number) => R): (_: any, args: T, ctx: AppContext) => MaybePromise<R> {
    return async function (_: any, args: T, ctx: AppContext) {
        if (!ctx.auth.uid) {
            throw new AccessDeniedError(ErrorText.permissionDenied);
        }
        let res = await fetchOrganizationId(ctx);
        if (!res) {
            throw new AccessDeniedError(ErrorText.permissionDenied);
        }

        return await resolver(ctx, args, ctx.auth.uid, res);
    };
}

export function withActivatedUser<T, R>(resolver: (ctx: AppContext, args: T, uid: number) => R): (_: any, args: T, ctx: AppContext) => MaybePromise<R> {
    return async function (_: any, args: T, ctx: AppContext) {
        if (!ctx.auth.uid) {
            throw new AccessDeniedError(ErrorText.permissionDenied);
        }
        let user = await FDB.User.findById(ctx, ctx.auth.uid);
        if (!user || user.status !== 'activated') {
            throw new AccessDeniedError(ErrorText.permissionDenied);
        }
        return resolver(ctx, args, ctx.auth.uid);
    };
}

export function withUser<T, R>(resolver: (ctx: AppContext, args: T, uid: number) => R): (_: any, args: T, ctx: AppContext) => MaybePromise<R> {
    return async function (_: any, args: T, ctx: AppContext) {
        if (!ctx.auth.uid) {
            throw new AccessDeniedError(ErrorText.permissionDenied);
        }
        return resolver(ctx, args, ctx.auth.uid);
    };
}

export function withAny<T, R>(resolver: (ctx: AppContext, args: T) => R): (_: any, args: T, ctx: AppContext) => MaybePromise<R> {
    return async (_: any, args: T, ctx: AppContext) => {
        return resolver(ctx, args);
    };
}

export function resolveUser<T extends { userId: number }>() {
    return function (src: T, args: T, ctx: AppContext) {
        return FDB.User.findById(ctx, src.userId);
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
                    field.resolve = async (root: any, args: any, context: AppContext, info: any) => {
                        if (!context || !context.ctx) {
                            let res = defaultContext;
                            res = CacheContext.set(res, new Map());
                            context = new GQLAppContext(res, info);
                        }
                        return await handler(type as GraphQLObjectType, field, fieldResolve!, root, args, context, info);
                    };
                }
            }
        }
    }
    return schema;
}
import { AccessDeniedError } from '../openland-errors/AccessDeniedError';
import { ErrorText } from '../openland-errors/ErrorText';
import { GraphQLField, GraphQLFieldResolver, GraphQLObjectType, GraphQLSchema } from 'graphql';
import { FDB } from 'openland-module-db/FDB';
import { Modules } from 'openland-modules/Modules';
import { AppContext } from 'openland-modules/AppContext';

async function fetchPermissions(ctx: AppContext) {
    if (ctx.cache.has('permissions')) {
        return (await ctx.cache.get('permissions')) as Set<string>;
    }
    let res = Modules.Super.resolvePermissions(ctx, { uid: ctx.auth.uid, oid: ctx.auth.oid });
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

        return resolver(ctx, args, ctx.auth.uid, res);
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

export function withAny<T, R>(resolver: (ctx: AppContext, args: T) => R): (_: any, args: T, ctx: AppContext) => MaybePromise<R>  {
    return async (_: any, args: T, ctx: AppContext) => {
        return resolver(ctx, args);
    };
}

export function resolveUser<T extends { userId: number }>() {
    return function (src: T, args: T, ctx: AppContext) {
        return FDB.User.findById(ctx, src.userId);
    };
}

type FieldHandler = (field: GraphQLField<any, any>, originalResolver: GraphQLFieldResolver<any, any, any>, root: any, args: any, context: any, info: any) => any;
export function wrapAllResolvers(schema: GraphQLSchema, f: FieldHandler) {
    let types = schema.getTypeMap();

    for (let typeName in types) {
        if (!Object.hasOwnProperty.call(types, typeName)) {
            continue;
        }

        let type = types[typeName];

        if (type instanceof GraphQLObjectType) {
            let fields = type.getFields();

            for (let fieldName in fields) {
                if (!Object.hasOwnProperty.call(fields, fieldName)) {
                    continue;
                }

                let field = fields[fieldName];

                let fieldResolve = field.resolve;
                if (field.resolve) {
                    field.resolve = async (root: any, args: any, context: AppContext, info: any) => {
                        return f(field, fieldResolve!, root, args, context, info);
                    };
                }
            }
        }
    }
    return schema;
}

export type MaybePromise<T> = Promise<T> | T;
export type FieldResolver<T> = (...args: any[]) => MaybePromise<T>;
export type FieldResolverWithRoot<T, R> = (root: R, ...args: any[]) => MaybePromise<T>;

export type Resolver<Root, Args, Context, ReturnType> = (root: Root, args: Args, context: Context) => MaybePromise<ReturnType>;

type Nullable<T> = undefined | null | T;
export type TypedResolver<T> = { [P in keyof T]: FieldResolver<T[P]> };
export type SoftlyTypedResolver<T> = { [P in keyof T]: (T[P] extends Nullable<object | object[]> ? FieldResolver<any> : FieldResolver<T[P]>) };
export type ResolverRootType<T> = { [K in keyof T]: T[K] extends (root: infer R, ...args: any[]) => any ? R : any }[keyof T];

export type TypeName<T> =
    T extends string ? 'string' :
    T extends number ? 'number' :
    T extends boolean ? 'boolean' :
    T extends undefined ? 'undefined' :
    T extends Function ? 'function' :
    'object';

export type SameType<A, B> = TypeName<A> extends TypeName<B> ? (A extends B ? true : false) : false;

export type ComplexTypedResolver<T, Root, ReturnTypesMap extends any, ArgTypesMap extends any> = {
    [P in keyof T]: (T[P] extends Nullable<object | object[]> ? Resolver<Root, ArgTypesMap[P], AppContext, ReturnTypesMap[P]> : Resolver<Root, ArgTypesMap[P], AppContext, T[P]>)
};
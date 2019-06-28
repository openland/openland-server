import { AppContext } from '../../openland-modules/AppContext';

export type MaybePromise<T> = Promise<T> | T;
export type UnwrapPromise<T> = T extends Promise<infer R> ? R : T;
export type FieldResolver<T> = (...args: any[]) => MaybePromise<T>;
export type FieldResolverWithRoot<T, R> = (root: R, ...args: any[]) => MaybePromise<T>;

export type Resolver<Root, Args, Context, ReturnType> = (root: Root, args: Args, context: Context) => MaybePromise<ReturnType>;
export type SubscriptionResolver<Root, Args, Context, ReturnType> = {
    resolve: (...args: any[]) => MaybePromise<ReturnType>,
    subscribe: Resolver<Root, Args, Context, AsyncIterable<any>|AsyncIterator<any>>
};

export type Nullable<T> = null | T;
export type OptionalNullable<T> = undefined | null | T;
export type TypedResolver<T> = { [P in keyof T]: FieldResolver<T[P]> };
export type ResolverRootType<T> = { [K in keyof T]: T[K] extends (root: infer R, ...args: any[]) => any ? R : T[K] }[keyof T];

export type ComplexTypedResolver<T, Root, ReturnTypesMap extends any, ArgTypesMap extends any> = {
    [P in keyof T]?: (T[P] extends Nullable<object | object[]> ? Resolver<Root, ArgTypesMap[P], AppContext, ReturnTypesMap[P]> : Resolver<Root, ArgTypesMap[P], AppContext, T[P]>)
};

export type ComplexTypedSubscriptionResolver<T, Root, ReturnTypesMap extends any, ArgTypesMap extends any> = {
    [P in keyof T]?: (T[P] extends Nullable<object | object[]> ? SubscriptionResolver<Root, ArgTypesMap[P], AppContext, ReturnTypesMap[P]> : SubscriptionResolver<Root, ArgTypesMap[P], AppContext, T[P]>)
};

export type UnionTypeResolver<Root, ReturnType> = {
    __resolveType: (obj: Root, ctx: AppContext) => MaybePromise<ReturnType>
};
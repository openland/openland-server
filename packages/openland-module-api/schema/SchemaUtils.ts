import { Context } from '@openland/context';
export type MaybePromise<T> = | T | Promise<T>;

export type Nullable<T> = null | T;
export type OptionalNullable<T> = undefined | null | T;

export type Resolver<Root, Args, C, ReturnType> = (root: Root, args: Args, context: C) => MaybePromise<ReturnType>;

export type SubscriptionResolver<Root, Args, C, ReturnType> = {
    resolve: (obj: ReturnType) => MaybePromise<ReturnType>,
    subscribe: Resolver<Root, Args, C, AsyncIterable<ReturnType> | AsyncIterator<ReturnType>>
};

export type UnionTypeResolver<Root, ReturnType> = {
    __resolveType: (obj: Root, ctx: Context) => MaybePromise<ReturnType>
};

export type InterfaceTypeResolver<Root, ReturnType> = {
    __resolveType: (obj: Root, ctx: Context) => MaybePromise<ReturnType>
};

export type ObjectRootResolver<Root> = {
    __resolveRoot?: (obj: Root, ctx: Context) => MaybePromise<Root>
}

export type ComplexTypedResolver<T, Root, ReturnTypesMap extends any, ArgTypesMap extends any> = {
    [P in keyof T]?:
    T[P] extends Nullable<object> ?
    Resolver<Root, ArgTypesMap[P], Context, ReturnTypesMap[P]> :
    T[P] extends Nullable<object[]> ? Resolver<Root, ArgTypesMap[P], Context, ReturnTypesMap[P]> : Resolver<Root, ArgTypesMap[P], Context, T[P]>
} & ObjectRootResolver<Root>;

export type ComplexTypedSubscriptionResolver<T, Root, ReturnTypesMap extends any, ArgTypesMap extends any> = {
    [P in keyof T]?: (T[P] extends Nullable<object | object[]> ? SubscriptionResolver<Root, ArgTypesMap[P], Context, ReturnTypesMap[P]> : SubscriptionResolver<Root, ArgTypesMap[P], Context, T[P]>)
};

export type EnumTypeResolver<Types extends string, Root> = {
    [P in Types]: Root
};

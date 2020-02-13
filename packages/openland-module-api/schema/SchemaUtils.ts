import { AppContext } from '../../openland-modules/AppContext';

export type MaybePromise<T> = | T | Promise<T>;

export type Nullable<T> = null | T;
export type OptionalNullable<T> = undefined | null | T;

export type Resolver<Root, Args, Context, ReturnType> = (root: Root, args: Args, context: Context) => MaybePromise<ReturnType>;

export type SubscriptionResolverBasic<Root, Args, Context, ReturnType> = {
    subscribe: Resolver<Root, Args, Context, AsyncIterable<ReturnType>|AsyncIterator<ReturnType>>
};

export type SubscriptionResolverExtended<Root, Args, Context, ReturnType> = {
    resolve: (obj: any) => MaybePromise<ReturnType>,
    subscribe: Resolver<Root, Args, Context, AsyncIterable<any>|AsyncIterator<any>>
};

export type SubscriptionResolver<Root, Args, Context, ReturnType> = SubscriptionResolverExtended<Root, Args, Context, ReturnType>;

export type UnionTypeResolver<Root, ReturnType> = {
    __resolveType: (obj: Root, ctx: AppContext) => MaybePromise<ReturnType>
};

export type InterfaceTypeResolver<Root, ReturnType> = {
    __resolveType: (obj: Root, ctx: AppContext) => MaybePromise<ReturnType>
};

export type ComplexTypedResolver<T, Root, ReturnTypesMap extends any, ArgTypesMap extends any> = {
    [P in keyof T]?:
    T[P] extends Nullable<object> ?
        Resolver<Root, ArgTypesMap[P], AppContext, ReturnTypesMap[P]> :
        T[P] extends Nullable<object[]> ? Resolver<Root, ArgTypesMap[P], AppContext, ReturnTypesMap[P]> :  Resolver<Root, ArgTypesMap[P], AppContext, T[P]>
};

export type ComplexTypedSubscriptionResolver<T, Root, ReturnTypesMap extends any, ArgTypesMap extends any> = {
    [P in keyof T]?: (T[P] extends Nullable<object | object[]> ? SubscriptionResolver<Root, ArgTypesMap[P], AppContext, ReturnTypesMap[P]> : SubscriptionResolver<Root, ArgTypesMap[P], AppContext, T[P]>)
};

export type EnumTypeResolver<Types extends string, Root> = {
    [P in Types]: Root
};

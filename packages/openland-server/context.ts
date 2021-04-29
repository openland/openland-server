import { CacheContext } from 'openland-module-api/CacheContext';
import { AuthContext } from 'openland-module-auth/AuthContext';
import { Context, ContextNamespaceType, registerExtension } from '@openland/context';
import { RequestContext } from 'openland-module-api/RequestContext';

declare module '@openland/context' {
    interface Context {
        readonly auth: ContextNamespaceType<typeof AuthContext>;
        readonly req: ContextNamespaceType<typeof RequestContext>;
        readonly cache: Map<string, any>;
    }
}

registerExtension('auth', (ctx) => {
    return AuthContext.get(ctx);
});
registerExtension('req', (ctx) => {
    return RequestContext.get(ctx);
});
registerExtension('cache', (ctx) => {
    return CacheContext.get(ctx)!;
});

export function contextSerialize(ctx: Context) {
    let auth: { uid?: number, tid?: string } = AuthContext.get(ctx);
    let request: { ip?: string, latLong?: { long: number, lat: number }, location?: { countryCode: string, location?: string } } = RequestContext.get(ctx);
    let cache = !!CacheContext.get(ctx);
    return JSON.stringify({
        auth, request, cache
    });
}

export function contextParse(ctx: Context, src: string) {
    const parsed = JSON.parse(src);
    ctx = AuthContext.set(ctx, parsed.auth);
    ctx = RequestContext.set(ctx, parsed.request);
    if (parsed.cache) {
        ctx = CacheContext.set(ctx, new Map());
    }
    return ctx;
}
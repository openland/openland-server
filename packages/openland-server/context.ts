import { CacheContext } from 'openland-module-api/CacheContext';
import { AuthContext } from 'openland-module-auth/AuthContext';
import { ContextNamespaceType, registerExtension } from '@openland/context';
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
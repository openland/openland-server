import { AuthContext } from 'openland-module-auth/AuthContext';
import { CacheContext } from 'openland-module-api/CacheContext';
import { GraphQLResolveInfo } from 'graphql';
import { Context, ContextNamespace, ContextWrapper } from '@openland/context';
import { RequestContext } from '../openland-module-api/RequestContext';

type ContextType<TContext extends ContextNamespace<any>> = TContext extends ContextNamespace<infer T> ? T : never;

export class AppContext extends ContextWrapper {
    readonly auth: ContextType<typeof AuthContext>;
    readonly req: ContextType<typeof RequestContext>;
    readonly cache: Map<string, any>;

    constructor(ctx: Context) {
        super(ctx);
        this.auth = AuthContext.get(ctx);
        this.cache = CacheContext.get(ctx)!;
        this.req = RequestContext.get(ctx);
    }
}

export class GQLAppContext extends AppContext {
    info: GraphQLResolveInfo;
    constructor(ctx: Context, info: GraphQLResolveInfo) {
        super(ctx);
        this.info = info;
    }

    getPath = () => {
        let path: string[] = [];
        try {
            let current = this.info.path;
            path.unshift(current.key + '');
            while (current.prev) {
                current = current.prev;
                path.unshift(current.key + '');
            }
        } catch {
            //
        }
        return path;
    }
}
import { Context, ContextWrapper } from 'openland-utils/Context';
import { AuthContext } from 'openland-module-auth/AuthContext';
import { CacheContext } from 'openland-module-api/CacheContext';
import { GraphQLResolveInfo } from 'graphql';

export class AppContext extends ContextWrapper {
    readonly auth: { uid?: number, oid?: number, tid?: string };
    readonly cache: Map<string, any>;

    constructor(ctx: Context) {
        super(ctx);
        this.auth = AuthContext.get(ctx);
        this.cache = CacheContext.get(ctx);
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
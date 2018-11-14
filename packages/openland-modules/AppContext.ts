import { Context, ContextWrapper } from 'openland-utils/Context';
import { AuthContext } from 'openland-module-auth/AuthContext';
import { CacheContext } from 'openland-module-api/CacheContext';

export class AppContext extends ContextWrapper {
    readonly auth: { uid?: number, oid?: number, tid?: string };
    readonly cache: Map<string, any>;

    constructor(ctx: Context) {
        super(ctx);
        this.auth = AuthContext.get(ctx);
        this.cache = CacheContext.get(ctx);
    }
}
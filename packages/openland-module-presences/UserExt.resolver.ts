import { withUser } from 'openland-module-users/User.resolver';
import { Modules } from 'openland-modules/Modules';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { AppContext, GQLAppContext } from 'openland-modules/AppContext';
import { withLogPath } from '@openland/log';
import { User } from 'openland-module-db/store';

export default {
    User: {
        online: withUser(async (ctx: AppContext, src: User) => {
            let path = ctx instanceof GQLAppContext ? ctx.getPath() : ['user.online.' + src.id + ' for ' + ctx.auth.uid];
            return await Modules.Presence.getLastSeen(withLogPath(ctx, path[0]), src.id) === 'online';
        }, true),
        lastSeen: withUser((ctx, src: User) => Modules.Presence.getLastSeen(withLogPath(ctx, 'user.lastSeen.' + src.id), src.id), true),
        active: withUser((ctx, src: User) => Modules.Presence.isActive(withLogPath(ctx, 'user.isActive.' + src.id), src.id), true),
    }
} as GQLResolver;

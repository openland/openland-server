import { withUser } from 'openland-module-users/User.resolver';
import { User } from 'openland-module-db/schema';
import { Modules } from 'openland-modules/Modules';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { withLogContext } from 'openland-log/withLogContext';
import { AppContext, GQLAppContext } from 'openland-modules/AppContext';

export default {
    User: {
        online: withUser(async (ctx: AppContext, src: User) => {
            let path = ctx instanceof GQLAppContext ? ctx.getPath() : ['user.online.' + src.id + ' for ' + ctx.auth.uid];
            return await Modules.Presence.getLastSeen(withLogContext(ctx, path), src.id) === 'online';
        }),
        lastSeen: withUser((ctx, src: User) => Modules.Presence.getLastSeen(withLogContext(ctx, ['user.lastSeen.' + src.id]), src.id)),
        active: withUser((ctx, src: User) => Modules.Presence.isActive(withLogContext(ctx, ['user.isActive.' + src.id]), src.id)),
    }
} as GQLResolver;
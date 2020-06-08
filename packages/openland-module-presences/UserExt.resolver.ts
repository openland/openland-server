import { Context } from '@openland/context';
import { withUser } from 'openland-module-users/User.resolver';
import { Modules } from 'openland-modules/Modules';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { withLogPath } from '@openland/log';
import { User } from 'openland-module-db/store';

export const Resolver: GQLResolver = {
    User: {
        online: withUser(async (ctx: Context, src: User) => {
            return await Modules.Presence.getLastSeen(ctx, src.id) === 'online';
        }, true),
        lastSeen: withUser((ctx, src: User) => Modules.Presence.getLastSeen(withLogPath(ctx, 'user.lastSeen.' + src.id), src.id), true),
        active: withUser((ctx, src: User) => Modules.Presence.isActive(withLogPath(ctx, 'user.isActive.' + src.id), src.id), true),
    }
};

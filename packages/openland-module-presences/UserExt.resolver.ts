import { Context } from '@openland/context';
import { withUser } from 'openland-module-users/User.resolver';
import { Modules } from 'openland-modules/Modules';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { User } from 'openland-module-db/store';

export const Resolver: GQLResolver = {
    User: {
        online: withUser(async (ctx: Context, src: User) => {
            return await Modules.Presence.getStatus(ctx, src.id) === 'online';
        }, true),
        lastSeen: withUser((ctx, src: User) => Modules.Presence.getStatus(ctx, src.id), true),
        active: withUser((ctx, src: User) => Modules.Presence.isActive(ctx, src.id), true),
    }
};

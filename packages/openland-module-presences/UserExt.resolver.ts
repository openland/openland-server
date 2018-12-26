import { withUser } from 'openland-module-users/User.resolver';
import { User } from 'openland-module-db/schema';
import { Modules } from 'openland-modules/Modules';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';

export default {
    User: {
        online: withUser(async (ctx, src: User) => await Modules.Presence.getLastSeen(ctx, src.id) === 'online'),
        lastSeen: withUser((ctx, src: User) => Modules.Presence.getLastSeen(ctx, src.id)),
        active: withUser((ctx, src: User) => Modules.Presence.isActive(ctx, src.id)),
    }
} as GQLResolver;
import { withUser } from 'openland-module-users/User.resolver';
import { User } from 'openland-module-db/schema';
import { Modules } from 'openland-modules/Modules';

export default {
    User: {
        online: withUser(async (src: User) => await Modules.Presence.getLastSeen(src.id) === 'online'),
        lastSeen: withUser((src: User) => Modules.Presence.getLastSeen(src.id)),
    }
};
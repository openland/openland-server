import { withUser } from 'openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { IDs } from 'openland-module-api/IDs';
import { ConferenceRoom } from 'openland-module-db/schema';
import { Context } from 'openland-utils/Context';

export default {
    Conference: {
        id: (src: ConferenceRoom) => IDs.Conference.serialize(src.id),
        members: (src: ConferenceRoom, args: {}, ctx: Context) => []
    },
    Query: {
        conference: withUser<{ id: string }, any>(async (ctx, args, uid) => {
            return Modules.Calls.repo.findConference(ctx, IDs.Conversation.parse(args.id));
        })
    }
};
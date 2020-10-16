import { IDs } from 'openland-module-api/IDs';
import { GQLResolver } from 'openland-module-api/schema/SchemaSpec';
import { Modules } from 'openland-modules/Modules';

export const Resolver: GQLResolver = {
    Sequence: {
        __resolveType: (src) => {
            if (src.type === 'common') {
                return 'SequenceCommon';
            } else if (src.type === 'chat') {
                return 'SequenceChat';
            }
            throw Error('Unknown sequence');
        }
    },
    SequenceCommon: {
        uid: (src, { }, ctx) => IDs.User.serialize(ctx.auth.uid!),
        unread: (src, { }, ctx) => Modules.Messaging.counters.fetchUserGlobalCounter(ctx, ctx.auth.uid!)
    },
    SequenceChat: {
        cid: (src, { }, ctx) => IDs.Conversation.serialize(src.cid),
        unread: (src, { }, ctx) => Modules.Messaging.counters.fetchUserUnreadInChat(ctx, ctx.auth.uid!, src.cid)
    }
};
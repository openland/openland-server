import { IDs } from 'openland-module-api/IDs';
import { GQLResolver } from 'openland-module-api/schema/SchemaSpec';
import { Modules } from 'openland-modules/Modules';

export const Resolver: GQLResolver = {
    Sequence: {
        __resolveType: (src, ctx) => {
            if (!ctx.auth.uid) {
                throw Error('Not authorized');
            }
            if (src.type === 'common') {
                if (ctx.auth.uid !== src.uid) {
                    throw Error('Invalid sequence');
                }
                return 'SequenceCommon';
            } else if (src.type === 'chat') {
                return 'SequenceChat';
            }
            throw Error('Unknown sequence');
        }
    },
    SequenceCommon: {
        id: (src, { }, ctx) => IDs.SequenceUser.serialize(ctx.auth.uid!),
        uid: (src, { }, ctx) => IDs.User.serialize(ctx.auth.uid!),
        unread: (src, { }, ctx) => Modules.Messaging.counters.fetchUserGlobalCounter(ctx, ctx.auth.uid!)
    },
    SequenceChat: {
        id: (src, { }, ctx) => IDs.SequenceChat.serialize(src.cid),
        cid: (src, { }, ctx) => IDs.Conversation.serialize(src.cid),
        unread: (src, { }, ctx) => Modules.Messaging.counters.fetchUserUnreadInChat(ctx, ctx.auth.uid!, src.cid)
    }
};
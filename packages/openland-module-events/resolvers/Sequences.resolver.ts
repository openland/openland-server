import { FeedReference } from './../Definitions';
import { IDs, IdsFactory } from 'openland-module-api/IDs';
import { GQLResolver } from 'openland-module-api/schema/SchemaSpec';
import { Modules } from 'openland-modules/Modules';
import { Store } from 'openland-module-db/FDB';

export function parseSequenceId(src: string, uid: number) {
    let sequence: FeedReference;
    let id = IdsFactory.resolve(src);
    if (id.type === IDs.SequenceUser) {
        sequence = { type: 'common', uid };
    } else if (id.type === IDs.SequenceChat) {
        sequence = { type: 'chat', cid: id.id as number };
    } else if (id.type === IDs.SequenceChatPrivate) {
        sequence = { type: 'chat-private', cid: id.id as number, uid };
    } else {
        throw Error('Invalid id');
    }
    return sequence;
}

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
            } else if (src.type === 'chat-private') {
                if (ctx.auth.uid !== src.uid) {
                    throw Error('Invalid sequence');
                }
                return 'SequenceChat';
            }
            throw Error('Unknown sequence');
        }
    },
    SequenceCommon: {
        id: (src, { }, ctx) => IDs.SequenceUser.serialize(ctx.auth.uid!),
    },
    SequenceChat: {
        id: (src, { }, ctx) => src.type === 'chat-private' ? IDs.SequenceChatPrivate.serialize(src.cid) : IDs.SequenceChat.serialize(src.cid),
        cid: (src, { }, ctx) => IDs.Conversation.serialize(src.cid),
        room: async (src, { }, ctx) => {
            if (await Modules.Messaging.room.userWasKickedFromRoom(ctx, ctx.auth.uid!, src.cid)) {
                return src.cid;
            } else if (!await Modules.Messaging.room.canUserSeeChat(ctx, ctx.auth.uid!, src.cid)) {
                return null;
            }
            return src.cid;
        },
        topMessage: async (src, args, ctx) => {
            if (src.type === 'chat') {
                if (!(await Modules.Messaging.room.isRoomMember(ctx, ctx.auth.uid!, src.cid))) {
                    return null;
                }
            }
            let res = (await Store.Message.chat.query(ctx, src.cid!, { limit: 1, reverse: true })).items;
            if (res.length > 0) {
                return res[0];
            } else {
                return null;
            }
        },
        states: async (src, { }, ctx) => {
            if (src.type === 'chat') {
                if (!(await Modules.Messaging.room.isRoomMember(ctx, ctx.auth.uid!, src.cid))) {
                    return null;
                }
            }
            let counter = await Modules.Messaging.counters.fetchUserUnreadInChat(ctx, ctx.auth.uid!, src.cid);
            let mentions = await Modules.Messaging.counters.fetchUserMentionsInChat(ctx, ctx.auth.uid!, src.cid);
            let readSeq = await Modules.Messaging.messaging.getUserReadSeq(ctx, src.cid, ctx.auth.uid!);
            return {
                counter, mentions, readSeq
            };
        }
    }
};
import { FeedReference } from './../Definitions';
import { IDs, IdsFactory } from 'openland-module-api/IDs';
import { GQLResolver } from 'openland-module-api/schema/SchemaSpec';

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
    }
};
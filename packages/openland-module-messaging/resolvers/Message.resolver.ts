import { Context } from '@openland/context';
import { Message } from 'openland-module-db/store';
import { IDs } from 'openland-module-api/IDs';
import { Store } from 'openland-module-db/FDB';
import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';

type MessageRoot = Message | number;

function withMessage<T>(handler: (ctx: Context, user: Message) => T) {
    return async (src: MessageRoot, _params: {}, ctx: Context) => {
        if (typeof src === 'number') {
            let msg = (await (Store.Message.findById(ctx, src)))!;
            return handler(ctx, msg);
        } else {
            return handler(ctx, src);
        }
    };
}

export const Resolver: GQLResolver = {
    Message: {
        id: src => IDs.Message.serialize(typeof src === 'number' ? src : src.id),
        date: withMessage((ctx, src) => src.metadata.createdAt),
        sender: withMessage((ctx, src) => src.uid),
        edited: withMessage((ctx, src) => src.edited || false),

        text: withMessage((ctx, src) => src.text),
        quoted: withMessage((ctx, src) => src.replyMessages || []),

        alphaReactions: withMessage((ctx, src) => src.reactions || []),
    }
};

import { Message } from 'openland-module-db/schema';
import { IDs } from 'openland-module-api/IDs';
import { FDB } from 'openland-module-db/FDB';
import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { AppContext } from 'openland-modules/AppContext';

type MessageRoot = Message | number;

function withMessage<T>(handler: (ctx: AppContext, user: Message) => T) {
    return async (src: MessageRoot, _params: {}, ctx: AppContext) => {
        if (typeof src === 'number') {
            let msg = (await (FDB.Message.findById(ctx, src)))!;
            return handler(ctx, msg);
        } else {
            return handler(ctx, src);
        }
    };
}

export default {
    Message: {
        id: (src: MessageRoot) => IDs.Message.serialize(typeof src === 'number' ? src : src.id),
        date: withMessage((ctx, src) => src.createdAt),
        sender: withMessage((ctx, src) => src.uid),
        edited: withMessage((ctx, src) => src.edited),

        text: withMessage((ctx, src) => src.text),
        quoted: withMessage((ctx, src) => src.replyMessages),

        alphaReactions: withMessage((ctx, src) => src.reactions),
    }
} as GQLResolver;
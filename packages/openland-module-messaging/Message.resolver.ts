import { Message } from 'openland-module-db/schema';
import { IDs } from 'openland-module-api/IDs';
import { CallContext } from 'openland-module-api/CallContext';
import { FDB } from 'openland-module-db/FDB';
import { GQL } from '../openland-module-api/schema/SchemaSpec';
import { typed } from '../openland-module-api/Resolvers';

type MessageRoot = Message | number;

function withMessage(handler: (user: Message, context: CallContext) => any) {
    return async (src: MessageRoot, _params: {}, context: CallContext) => {
        if (typeof src === 'number') {
            let msg = (await (FDB.Message.findById(src)))!;
            return handler(msg, context);
        } else {
            return handler(src, context);
        }
    };
}

export default {
    Message: typed<GQL.Message>({
        id: (src: MessageRoot) => IDs.Message.serialize(typeof src === 'number' ? src : src.id),
        date: withMessage((src) => src.createdAt),
        sender: withMessage((src) => src.uid),
        edited: withMessage((src) => src.edited),

        text: withMessage((src) => src.text),
        quoted: withMessage((src) => src.replyMessages),

        alphaReactions: withMessage((src) => src.reactions),
    })
};
import { Store } from 'openland-module-db/FDB';
import { IDs } from 'openland-module-api/IDs';
import { withUser } from 'openland-module-api/Resolvers';
import { GQLResolver } from 'openland-module-api/schema/SchemaSpec';
import { Modules } from 'openland-modules/Modules';

export const Resolver: GQLResolver = {
    SyncChat: {
        conversation: (src) => src.conversation,
        sequence: (src) => src.sequence
    },
    SyncChatsConnection: {
        items: (src) => src.items,
        cursor: (src) => src.cursor
    },
    Query: {
        syncUserChats: withUser(async (ctx, args, uid) => {
            let after = 0;
            if (args.after) {
                after = IDs.ChatSyncAfter.parse(args.after);
            }

            let dialogs = await Modules.Messaging.loadUserDialogs(ctx, uid, after);
            let conversations = await Promise.all(dialogs.map(async (d) => (await Store.Conversation.findById(ctx, d))!));

            // Resolve cursor
            let cursor: string | null = null;
            if (dialogs.length > 0) {
                cursor = IDs.ChatSyncAfter.serialize(dialogs[dialogs.length - 1]);
            }

            return {
                items: conversations.map((conv) => ({
                    conversation: conv,
                    sequence: conv.kind === 'private' ? { type: 'chat-private', cid: conv.id, uid } : { type: 'chat', cid: conv.id }
                })),
                cursor
            };
        })
    }
};
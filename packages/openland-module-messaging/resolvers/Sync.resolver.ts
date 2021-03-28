import { Store } from 'openland-module-db/FDB';
import { IDs } from 'openland-module-api/IDs';
import { withUser } from 'openland-module-api/Resolvers';
import { GQLResolver } from 'openland-module-api/schema/SchemaSpec';
import { Modules } from 'openland-modules/Modules';

export const Resolver: GQLResolver = {
    SyncChat: {
        sequence: (src) => src.sequence,
        pts: async (src, _, ctx) => Modules.Events.mediator.getFeedSubscriberPts(ctx, src.sequence, ctx.auth.uid!)
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

            let dialogs = await Modules.Messaging.loadUserDialogs(ctx, uid, after, args.first);
            let conversations = await Promise.all(dialogs.map(async (d) => (await Store.Conversation.findById(ctx, d))!));

            // Preload membership
            await Promise.all(conversations.map((conv) => conv.kind !== 'private' ?
                Modules.Messaging.room.isRoomMember(ctx, ctx.auth.uid!, conv.id) :
                null));

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
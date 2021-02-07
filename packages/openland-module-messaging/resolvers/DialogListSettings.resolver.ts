import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { withActivatedUser } from '../../openland-module-api/Resolvers';
import { Modules } from '../../openland-modules/Modules';
import { IDs } from '../../openland-module-api/IDs';
import { inTx } from '@openland/foundationdb';

export const Resolver: GQLResolver = {
    DialogListSettings: {
        pinnedChats: root => root.pinnedChats,
    },
    Query: {
        dialogListSettings: withActivatedUser(async (ctx, args, uid) => {
            return await Modules.Messaging.dialogListSettings.getUserSettings(ctx, uid);
        })
    },
    Mutation: {
        dialogListPin: withActivatedUser(async (parent, args, uid) => {
            return await inTx(parent, async ctx => {
                await Modules.Messaging.dialogListSettings.pinChat(ctx, uid, IDs.Conversation.parse(args.id));
                return true;
            });
        }),
        dialogListUnpin: withActivatedUser(async (parent, args, uid) => {
            return await inTx(parent, async ctx => {
                await Modules.Messaging.dialogListSettings.unpinChat(ctx, uid, IDs.Conversation.parse(args.id));
                return true;
            });
        }),
        dialogListUpdatePinned: withActivatedUser(async (parent, args, uid) => {
            return await inTx(parent, async ctx => {
                await Modules.Messaging.dialogListSettings.editPinned(ctx, uid, args.pinned.map(a => IDs.Conversation.parse(a)));
                return true;
            });
        })
    }
};
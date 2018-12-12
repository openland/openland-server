import { withUser } from 'openland-module-api/Resolvers';
import { FDB } from 'openland-module-db/FDB';
import { UserDialog } from 'openland-module-db/schema';
import { IDs } from 'openland-module-api/IDs';
import { Modules } from 'openland-modules/Modules';
import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { AuthContext } from 'openland-module-auth/AuthContext';
import { AppContext } from 'openland-modules/AppContext';

export default {
    Dialog: {
        id: (src: UserDialog) => IDs.Dialog.serialize(src.cid),
        cid: (src: UserDialog) => IDs.Conversation.serialize(src.cid),
        fid: async (src: UserDialog, args: {}, ctx: AppContext) => {
            let conv = (await FDB.Conversation.findById(ctx, src.cid))!;
            if (conv.kind === 'organization') {
                return IDs.Organization.serialize((await FDB.ConversationOrganization.findById(ctx, src.cid))!.oid);
            } else if (conv.kind === 'private') {
                let pc = (await FDB.ConversationPrivate.findById(ctx, conv.id))!;
                let auth = AuthContext.get(ctx);
                if (pc.uid1 === auth.uid) {
                    return IDs.User.serialize(pc.uid2);
                } else if (pc.uid2 === auth.uid) {
                    return IDs.User.serialize(pc.uid1);
                } else {
                    throw Error('Unknwon conversation type');
                }
            } else if (conv.kind === 'room') {
                return IDs.Conversation.serialize(src.cid);
            } else {
                throw Error('Unknwon conversation type');
            }
        },
        kind: async (src: UserDialog, args: {}, ctx: AppContext) => {
            let conv = (await FDB.Conversation.findById(ctx, src.cid))!;
            if (conv.kind === 'organization') {
                return 'INTERNAL';
            } else if (conv.kind === 'private') {
                return 'PRIVATE';
            } else if (conv.kind === 'room') {
                let room = (await FDB.ConversationRoom.findById(ctx, src.cid))!;
                if (room.kind === 'group') {
                    return 'GROUP';
                } else if (room.kind === 'internal') {
                    return 'INTERNAL';
                } else if (room.kind === 'public') {
                    return 'PUBLIC';
                } else {
                    throw Error('Unknown room type');
                }
            } else {
                throw Error('Unknwon conversation type');
            }
        },

        title: async (src: UserDialog, args: {}, ctx: AppContext) => {
            return Modules.Messaging.room.resolveConversationTitle(ctx, src.cid, ctx.auth.uid!);
        },
        photo: async (src: UserDialog, args: {}, ctx: AppContext) => {
            return await Modules.Messaging.room.resolveConversationPhoto(ctx, src.cid, ctx.auth.uid!);
        },

        unreadCount: async (src: UserDialog) => {
            return src.unread;
        },

        topMessage: (src: UserDialog, args: {}, ctx: AppContext) => Modules.Messaging.findTopMessage(ctx, src.cid),
        betaTopMessage: (src: UserDialog, args: {}, ctx: AppContext) => Modules.Messaging.findTopMessage(ctx, src.cid),
        isMuted: async (src: UserDialog, _, ctx) => {
            let settings = await Modules.Messaging.getRoomSettings(ctx, ctx.auth.uid!, src.cid);
            return settings.mute;
        },
        haveMention: async (src: UserDialog, _, ctx) => {
            let local = await Modules.Messaging.getUserDialogState(ctx, ctx.auth.uid!, src.cid);
            return local.haveMention || false;
        },
    },
    Query: {
        dialogs: withUser(async (ctx, args, uid) => {
            return FDB.UserDialog.rangeFromUserWithCursor(ctx, uid, args.first, args.after ? args.after : undefined, true);
        }),
        alphaChats: withUser(async (ctx, args, uid) => {
            let global = await FDB.UserMessagingState.findById(ctx, uid);
            let seq = global ? global.seq : 0;
            let conversations = await FDB.UserDialog
                .rangeFromUserWithCursor(ctx, uid, args.first, args.after ? args.after : undefined, true);
            let res = await Promise.all(conversations.items.map((v) => FDB.Conversation.findById(ctx, v.cid)));
            let index = 0;
            for (let r of res) {
                if (!r) {
                    console.warn('Unable to find conversation: ' + conversations.items[index].cid);
                }
                index++;
            }
            return {
                conversations: res,
                seq: seq,
                next: conversations.cursor,
                counter: uid
            };
        }),
    }
} as GQLResolver;
import { withUser } from 'openland-module-api/Resolvers';
import { Store } from 'openland-module-db/FDB';
import { UserDialog } from 'openland-module-db/store';
import { IDs } from 'openland-module-api/IDs';
import { Modules } from 'openland-modules/Modules';
import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { AuthContext } from 'openland-module-auth/AuthContext';
import { AppContext } from 'openland-modules/AppContext';
import { encoders } from '@openland/foundationdb';

export default {
    Dialog: {
        id: (src: UserDialog) => IDs.Dialog.serialize(src.cid),
        cid: (src: UserDialog) => IDs.Conversation.serialize(src.cid),
        fid: async (src: UserDialog, args: {}, ctx: AppContext) => {
            let conv = (await Store.Conversation.findById(ctx, src.cid))!;
            if (conv.kind === 'organization') {
                return IDs.Organization.serialize((await Store.ConversationOrganization.findById(ctx, src.cid))!.oid);
            } else if (conv.kind === 'private') {
                let pc = (await Store.ConversationPrivate.findById(ctx, conv.id))!;
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
            let conv = (await Store.Conversation.findById(ctx, src.cid))!;
            if (conv.kind === 'organization') {
                return 'INTERNAL';
            } else if (conv.kind === 'private') {
                return 'PRIVATE';
            } else if (conv.kind === 'room') {
                let room = (await Store.ConversationRoom.findById(ctx, src.cid))!;
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
        isChannel: async (src: UserDialog, args: {}, ctx: AppContext) => {
            let room = await Store.ConversationRoom.findById(ctx, src.cid);
            return !!(room && room.isChannel);
        },

        title: async (src: UserDialog, args: {}, ctx: AppContext) => {
            return Modules.Messaging.room.resolveConversationTitle(ctx, src.cid, ctx.auth.uid!);
        },
        photo: async (src: UserDialog, args: {}, ctx: AppContext) => {
            return await Modules.Messaging.room.resolveConversationPhoto(ctx, src.cid, ctx.auth.uid!);
        },

        unreadCount: async (src: UserDialog, args: {}, ctx: AppContext) => {
            return Store.UserDialogCounter.byId(src.uid, src.cid).get(ctx);
        },

        topMessage: (src: UserDialog, args: {}, ctx: AppContext) => Modules.Messaging.findTopMessage(ctx, src.cid),
        betaTopMessage: (src: UserDialog, args: {}, ctx: AppContext) => Modules.Messaging.findTopMessage(ctx, src.cid),
        alphaTopMessage: (src: UserDialog, args: {}, ctx: AppContext) => Modules.Messaging.findTopMessage(ctx, src.cid),
        isMuted: async (src: UserDialog, _, ctx) => await Modules.Messaging.isChatMuted(ctx, ctx.auth.uid!, src.cid),
        haveMention: async (src: UserDialog, _, ctx) => {
            return await Store.UserDialogHaveMention.byId(ctx.auth.uid!, src.cid).get(ctx);
        },
    },
    Query: {
        dialogs: withUser(async (ctx, args, uid) => {
            if (args.first <= 0) {
                return [];
            }

            let allDialogs = await Modules.Messaging.findUserDialogs(ctx, uid);
            allDialogs = allDialogs.filter((a) => !!a.date);
            allDialogs.sort((a, b) => -(a.date!! - b.date!!));

            if (args.after) {
                let dc = encoders.tuple.unpack(Buffer.from(args.after, 'hex'));
                let aft = dc[0] as number;
                allDialogs = allDialogs.filter((v) => v.date! <= aft);
            }

            if (allDialogs.length <= args.first) {
                return {
                    items: allDialogs.map((v) => Store.UserDialog.findById(ctx, uid, v.cid)),
                    cursor: undefined,
                    hasMore: false
                };
            } else {
                let cursor = encoders.tuple.pack([allDialogs[args.first].date!]).toString('hex');
                return {
                    items: allDialogs.slice(0, args.first).map((v) => Store.UserDialog.findById(ctx, uid, v.cid)),
                    cursor: cursor,
                    hasMore: true
                };
            }
        })
    }
} as GQLResolver;
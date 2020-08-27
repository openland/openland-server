import { Context } from '@openland/context';
import { withUser } from 'openland-module-api/Resolvers';
import { Store } from 'openland-module-db/FDB';
import { IDs } from 'openland-module-api/IDs';
import { Modules } from 'openland-modules/Modules';
import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { AuthContext } from 'openland-module-auth/AuthContext';
import { encoders } from '@openland/foundationdb';

const USE_NEW_COUNTERS = false;

export const Resolver: GQLResolver = {
    Dialog: {
        id: (src: { cid: number }) => IDs.Dialog.serialize(src.cid),
        cid: (src: { cid: number }) => IDs.Conversation.serialize(src.cid),
        fid: async (src: { cid: number }, args: {}, ctx: Context) => {
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
        kind: async (src: { cid: number }, args: {}, ctx: Context) => {
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
        isChannel: async (src: { cid: number }, args: {}, ctx: Context) => {
            let room = await Store.ConversationRoom.findById(ctx, src.cid);
            return !!(room && room.isChannel);
        },
        isPremium: async (src: { cid: number }, args: {}, ctx: Context) => {
            let room = await Store.ConversationRoom.findById(ctx, src.cid);
            return !!(room && room.isPremium);
        },

        title: async (src: { cid: number }, args: {}, ctx: Context) => {
            return Modules.Messaging.room.resolveConversationTitle(ctx, src.cid, ctx.auth.uid!);
        },
        photo: async (src: { cid: number }, args: {}, ctx: Context) => {
            return await Modules.Messaging.room.resolveConversationPhoto(ctx, src.cid, ctx.auth.uid!);
        },

        unreadCount: async (src, args: {}, ctx: Context) => {
            if (USE_NEW_COUNTERS) {
                return src.counter.unreadCounter;
            }
            return Store.UserDialogCounter.byId(ctx.auth.uid!, src.cid).get(ctx);
        },

        topMessage: (src: { cid: number }, args: {}, ctx: Context) => Modules.Messaging.findTopMessage(ctx, src.cid, ctx.auth.uid!),
        betaTopMessage: (src: { cid: number }, args: {}, ctx: Context) => Modules.Messaging.findTopMessage(ctx, src.cid, ctx.auth.uid!),
        alphaTopMessage: (src: { cid: number }, args: {}, ctx: Context) => Modules.Messaging.findTopMessage(ctx, src.cid, ctx.auth.uid!),
        isMuted: async (src: { cid: number }, _, ctx) => await Modules.Messaging.isChatMuted(ctx, ctx.auth.uid!, src.cid),
        haveMention: async (src, _, ctx) => {
            if (USE_NEW_COUNTERS) {
                return src.counter.haveMention;
            }
            return await Store.UserDialogHaveMention.byId(ctx.auth.uid!, src.cid).get(ctx);
        },
        hasActiveCall: async (src, _, ctx) => {
            return !!(await Modules.Calls.repo.getOrCreateConference(ctx, src.cid)).active;
        },
        membership: async (src, args, ctx) => ctx.auth.uid ? await Modules.Messaging.room.resolveUserMembershipStatus(ctx, ctx.auth.uid, src.cid) : 'none'
    },
    Query: {
        dialogs: withUser(async (ctx, args, uid) => {
            if (args.first <= 0) {
                return { items: [], cursor: undefined };
            }

            let allDialogs = await Modules.Messaging.findUserDialogs(ctx, uid);
            allDialogs = allDialogs.filter((a) => !!a.date);
            allDialogs.sort((a, b) => -(a.date!! - b.date!!));

            if (args.after) {
                let dc = encoders.tuple.unpack(Buffer.from(args.after, 'hex'));
                let aft = dc[0] as number;
                allDialogs = allDialogs.filter((v) => v.date! <= aft);
            }

            let cursor: string|undefined = undefined;
            if (allDialogs.length > args.first) {
                cursor = encoders.tuple.pack([allDialogs[args.first].date!]).toString('hex');
            }
            allDialogs = allDialogs.slice(0, args.first);

            let counters = await Modules.Messaging.fetchUserCountersForChats(ctx, uid, allDialogs.map(d => d.cid));
            let items = allDialogs.map(dialog => {
                let counter = counters.find(c => c.cid === dialog.cid) || {unreadCounter: 0, haveMention: false};
                return {
                    cid: dialog.cid,
                    counter
                };
            });
            return {
                items,
                cursor: cursor
            };
        })
    }
};

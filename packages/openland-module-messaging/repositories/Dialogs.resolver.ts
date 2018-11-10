import { withUser } from 'openland-module-api/Resolvers';
import { FDB } from 'openland-module-db/FDB';
import { UserDialog } from 'openland-module-db/schema';
import { IDs } from 'openland-module-api/IDs';
import { Modules } from 'openland-modules/Modules';
import { CallContext } from 'openland-module-api/CallContext';

export default {
    Dialog: {
        id: (src: UserDialog) => IDs.Dialog.serialize(src.cid),
        cid: (src: UserDialog) => IDs.Conversation.serialize(src.cid),
        fid: async (src: UserDialog, args: {}, context: CallContext) => {
            let conv = (await FDB.Conversation.findById(src.cid))!;
            if (conv.kind === 'organization') {
                return IDs.Organization.serialize((await FDB.ConversationOrganization.findById(src.cid))!.oid);
            } else if (conv.kind === 'private') {
                let pc = (await FDB.ConversationPrivate.findById(conv.id))!;
                if (pc.uid1 === context.uid) {
                    return IDs.User.serialize(pc.uid2);
                } else if (pc.uid2 === context.uid) {
                    return IDs.User.serialize(pc.uid2);
                } else {
                    throw Error('Unknwon conversation type');
                }
            } else if (conv.kind === 'room') {
                return IDs.Conversation.serialize(src.cid);
            } else {
                throw Error('Unknwon conversation type');
            }
        },
        kind: async (src: UserDialog) => {
            let conv = (await FDB.Conversation.findById(src.cid))!;
            if (conv.kind === 'organization') {
                return 'INTERNAL';
            } else if (conv.kind === 'private') {
                return 'PRIVATE';
            } else if (conv.kind === 'room') {
                let room = (await FDB.ConversationRoom.findById(src.cid))!;
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

        title: async (src: UserDialog, args: {}, context: CallContext) => {
            return Modules.Messaging.conv.resolveConversationTitle(src.cid, context.uid!);
        },
        photo: async (src: UserDialog, args: {}, context: CallContext) => {
            return await Modules.Messaging.conv.resolveConversationPhoto(src.cid, context.uid!);
        },

        unreadCount: async (src: UserDialog) => {
            return src.unread;
        },

        topMessage: (src: UserDialog) => Modules.Messaging.repo.findTopMessage(src.cid),
    },
    Query: {
        dialogs: withUser<{ first: number, after?: string | null, seq?: number }>(async (args, uid) => {
            return FDB.UserDialog.rangeFromUserWithCursor(uid, args.first, args.after ? args.after : undefined, true);
        }),
        alphaChats: withUser<{ first: number, after?: string | null, seq?: number }>(async (args, uid) => {
            let global = await FDB.UserMessagingState.findById(uid);
            let seq = global ? global.seq : 0;
            let conversations = await FDB.UserDialog
                .rangeFromUserWithCursor(uid, args.first, args.after ? args.after : undefined, true);
            let res = await Promise.all(conversations.items.map((v) => FDB.Conversation.findById(v.cid)));
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
};
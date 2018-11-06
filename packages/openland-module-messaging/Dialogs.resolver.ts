import { withUser } from 'openland-server/api/utils/Resolvers';
import { FDB } from 'openland-module-db/FDB';

export default {
    Query: {
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
        dialogs: withUser<{ first: number, after?: string | null, seq?: number }>(async (args, uid) => {
            let conversations = await FDB.UserDialog
                .rangeFromUserWithCursor(uid, args.first, args.after ? args.after : undefined, true);
            return {
                conversations: conversations.items.map((v) => FDB.Conversation.findById(v.cid)),
                next: conversations.cursor
            };
        }),
    }
};
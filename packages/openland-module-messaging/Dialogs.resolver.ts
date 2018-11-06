import { withUser } from 'openland-server/api/utils/Resolvers';
import { FDB } from 'openland-module-db/FDB';
import { DB } from 'openland-server/tables';

export default {
    Query: {
        alphaChats: withUser<{ first: number, after?: string | null, seq?: number }>(async (args, uid) => {
            let global = await FDB.UserMessagingState.findById(uid);
            let seq = global ? global.seq : 0;
            let conversations = await FDB.UserDialog
                .rangeFromUserWithCursor(uid, args.first, args.after ? args.after : undefined, true);
            // let res = await Promise.all(conversations.items.map((v) => FDB.Conversation.findById(v.cid)));
            // console.log(res);
            let convs = await DB.Conversation.findAll({
                where: {
                    id: {
                        $in: conversations.items.map((v) => v.cid)
                    }
                }
            });
            let res: any[] = [];
            for (let c of conversations.items) {
                res.push(convs.find((v) => v.id === c.cid));
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
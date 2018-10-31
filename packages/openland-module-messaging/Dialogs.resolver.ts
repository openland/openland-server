import { CallContext } from 'openland-server/api/utils/CallContext';
import { DB } from 'openland-server/tables';
import { Repos } from 'openland-server/repositories';
import { withUser } from 'openland-server/api/utils/Resolvers';
import { FDB } from 'openland-module-db/FDB';

export default {
    Query: {
        alphaChats: withUser<{ first: number, after?: string | null, seq?: number }>(async (args, uid) => {
            let global = await FDB.UserMessagingState.findById(uid);
            let seq = global ? global.seq : 0;
            let conversations = await FDB.UserDialog
                .rangeFromUserWithCursor(uid, args.first, args.after ? args.after : undefined, true);
            return {
                conversations: conversations.items.map((v) => DB.Conversation.findById(v.cid)),
                seq: seq,
                next: conversations.cursor,
                counter: uid
            };
        }),
    },
    Subscription: {
        dialogUpdates: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async function (_: any, args: { fromSeq?: number }, context: CallContext) {
                //
            }
        },
        alphaSubscribeEvents: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async function (_: any, args: { fromSeq?: number }, context: CallContext) {
                let ended = false;
                return {
                    ...(async function* func() {
                        let lastKnownSeq = args.fromSeq;
                        while (!ended) {
                            if (lastKnownSeq !== undefined) {
                                let events = await DB.ConversationUserEvents.findAll({
                                    where: {
                                        userId: context.uid,
                                        seq: {
                                            $gt: lastKnownSeq
                                        }
                                    },
                                    order: [['seq', 'asc']]
                                });
                                for (let r of events) {
                                    yield r;
                                }
                                if (events.length > 0) {
                                    lastKnownSeq = events[events.length - 1].seq;
                                }
                            }
                            let res = await Repos.Chats.userReader.loadNext(context.uid!!, lastKnownSeq ? lastKnownSeq : null);
                            if (!lastKnownSeq) {
                                lastKnownSeq = res - 1;
                            }
                        }
                    })(),
                    return: async () => {
                        ended = true;
                        return 'ok';
                    }
                };
            }
        },
    }
};
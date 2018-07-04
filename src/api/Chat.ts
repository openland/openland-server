import { ConversationMessage } from '../tables/ConversationMessage';
import { IDs } from './utils/IDs';
import { Conversation } from '../tables/Conversation';
import { DB } from '../tables';
import { withPermission, withAny, withAccount } from './utils/Resolvers';
import { validate, stringNotEmpty } from '../modules/NewInputValidator';
import { NotFoundError } from '../errors/NotFoundError';
import { ConversationEvent } from '../tables/ConversationEvent';
import { CallContext } from './utils/CallContext';
import { Repos } from '../repositories';
import { DoubleInvokeError } from '../errors/DoubleInvokeError';

export const Resolver = {
    ConversationMessage: {
        id: (src: ConversationMessage) => IDs.ConversationMessage.serialize(src.id),
        message: (src: ConversationMessage) => src.message,
        sender: (src: ConversationMessage, _: any, context: CallContext) => Repos.Users.userLoader(context).load(src.userId),
        date: (src: ConversationMessage) => src.createdAt.toUTCString()
    },
    Conversation: {
        id: (src: Conversation) => IDs.Conversation.serialize(src.id),
        title: (src: Conversation) => src.title
    },
    ConversationEvent: {
        __resolveType(obj: ConversationEvent) {
            if (obj.eventType === 'new_message') {
                return 'ConversationEventMessage';
            } else if (obj.eventType === 'delete_message') {
                return 'ConversationEventDelete';
            }
            throw Error('Unknown type');
        },
        seq: (src: ConversationEvent) => src.seq
    },
    ConversationEventMessage: {
        message: (src: ConversationEvent) => DB.ConversationMessage.findById(src.event.messageId as number)
    },
    ConversationEventDelete: {
        messageId: (src: ConversationEvent) => IDs.ConversationMessage.serialize(src.event.messageId as number)
    },
    Query: {
        superAllChats: withPermission('software-developer', (args) => {
            return DB.Conversation.findAll({
                order: ['createdAt']
            });
        }),
        alphaChat: withAny<{ conversationId: string }>((args) => {
            let conversationId = IDs.Conversation.parse(args.conversationId);
            return DB.Conversation.findById(conversationId);
        }),
        alphaLoadMessages: withAny<{ conversationId: string }>((args) => {
            let conversationId = IDs.Conversation.parse(args.conversationId);
            return DB.tx(async (tx) => {
                let seq = (await DB.Conversation.findById(conversationId))!!.seq;
                return {
                    seq: seq,
                    messages: await (DB.ConversationMessage.findAll({
                        where: {
                            conversationId: conversationId
                        },
                        order: [['createdAt', 'DESC']],
                        transaction: tx
                    }))
                };
            });
        })
    },
    Mutation: {
        superCreateChat: withPermission<{ title: string }>('software-developer', (args) => {
            validate({ title: stringNotEmpty() }, args);
            return DB.Conversation.create({
                title: args.title
            });
        }),
        alphaSendMessage: withAccount<{ conversationId: string, message: string, repeatKey?: string | null }>(async (args, uid) => {
            validate({ message: stringNotEmpty() }, args);
            let conversationId = IDs.Conversation.parse(args.conversationId);
            return await DB.tx(async (tx) => {

                if (args.repeatKey) {
                    if (await DB.ConversationMessage.find({
                        where: {
                            userId: uid,
                            conversationId: conversationId,
                            repeatToken: args.repeatKey
                        },
                        transaction: tx,
                        lock: tx.LOCK.UPDATE
                    })) {
                        throw new DoubleInvokeError();
                    }
                }

                let conv = await DB.Conversation.findById(conversationId, { lock: tx.LOCK.UPDATE, transaction: tx });
                if (!conv) {
                    throw new NotFoundError('Conversation not found');
                }
                let seq = conv.seq + 1;
                conv.seq = seq;
                await conv.save({ transaction: tx });

                let msg = await DB.ConversationMessage.create({
                    message: args.message,
                    conversationId: conversationId,
                    userId: uid,
                    repeatToken: args.repeatKey
                }, { transaction: tx });
                let res = await DB.ConversationEvent.create({
                    conversationId: conversationId,
                    eventType: 'new_message',
                    event: {
                        messageId: msg.id
                    },
                    seq: seq
                }, { transaction: tx });

                if (args.message === 'delete') {
                    seq = seq + 1;
                    conv.seq = seq;
                    await conv.save({ transaction: tx });
                    await DB.ConversationEvent.create({
                        conversationId: conversationId,
                        eventType: 'delete_message',
                        event: {
                            messageId: msg.id
                        },
                        seq: seq
                    }, { transaction: tx });
                    // (tx as any).afterCommit(() => {
                    //     pubsub.publish('chat_' + conversationId, { eventId: res2.id });
                    // });
                }

                // (tx as any).afterCommit(() => {
                //     pubsub.publish('chat_' + conversationId, { eventId: res.id });
                // });
                return res;
            });
        })
    },
    Subscription: {
        alphaChatSubscribe: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async function* (_: any, args: { conversationId: string, fromSeq?: number }) {
                let conversationId = IDs.Conversation.parse(args.conversationId);
                let lastKnownSeq = args.fromSeq;

                while (true) {
                    if (lastKnownSeq !== undefined) {
                        let events = await DB.ConversationEvent.findAll({
                            where: {
                                conversationId: conversationId,
                                seq: {
                                    $gt: lastKnownSeq
                                }
                            },
                            order: ['seq']
                        });
                        for (let r of events) {
                            yield r;
                        }
                        if (events.length > 0) {
                            lastKnownSeq = events[events.length - 1].seq;
                        }
                    }
                    let res = await new Promise<number>((resolve) => Repos.Chats.reader.loadNext(conversationId, lastKnownSeq ? lastKnownSeq : null, (arg) => resolve(arg)));
                    if (!lastKnownSeq) {
                        lastKnownSeq = res - 1;
                    }
                }
                // let lastMessageId: number[] = [];
                // let breakable: (() => void) | null = null;
                // pubsub.subscribe('chat_' + conversationId, (msg) => {
                //     lastMessageId.push(msg.eventId);
                //     if (breakable) {
                //         breakable();
                //         breakable = null;
                //     }
                // });
                // while (true) {
                //     if (lastMessageId.length === 0) {
                //         let delay = delayBreakable(1000);
                //         breakable = delay.resolver;
                //         await delay.promise;
                //     }
                //     if (lastMessageId.length > 0) {
                //         for (let msg of lastMessageId) {
                //             yield await DB.ConversationEvent.findById(msg);
                //         }
                //         lastMessageId = [];
                //     }
                // }
            }
        }
    }
};
import { ConversationMessage } from '../tables/ConversationMessage';
import { IDs } from './utils/IDs';
import { Conversation } from '../tables/Conversation';
import { DB } from '../tables';
import { withPermission, withAny, withAccount } from './utils/Resolvers';
import { validate, stringNotEmpty } from '../modules/NewInputValidator';
import { Pubsub } from '../modules/pubsub';
import { delayBreakable } from '../utils/timer';
import { NotFoundError } from '../errors/NotFoundError';
import { ConversationEvent } from '../tables/ConversationEvent';

let pubsub = new Pubsub<{ eventId: number }>();

export const Resolver = {
    ConversationMessage: {
        id: (src: ConversationMessage) => IDs.ConversationMessage.serialize(src.id),
        message: (src: ConversationMessage) => src.message,
        sender: (src: ConversationMessage) => DB.User.findById(src.userId),
        date: (src: ConversationMessage) => src.createdAt
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
        alphaSendMessage: withAccount<{ conversationId: string, message: string }>(async (args, uid) => {
            validate({ message: stringNotEmpty() }, args);
            let conversationId = IDs.Conversation.parse(args.conversationId);
            return await DB.tx(async (tx) => {

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
                    userId: uid
                }, { transaction: tx });
                let res = await DB.ConversationEvent.create({
                    conversationId: conversationId,
                    eventType: 'new_message',
                    event: {
                        messageId: msg.id
                    },
                    seq: seq
                }, { transaction: tx });

                // (tx as any).afterCommit(() => {
                //     pubsub.publish('chat_' + conversationId, { eventId: res.id });
                // });
                pubsub.publish('chat_' + conversationId, { eventId: res.id });
                return res;
            });
        })
    },
    Subscription: {
        alphaChatSubscribe: {
            resolve: async (msg: number) => {
                return DB.ConversationEvent.findById(msg);
            },
            subscribe: async function* (_: any, args: { conversationId: string }) {
                console.warn('subscribe');
                let conversationId = IDs.Conversation.parse(args.conversationId);
                let lastMessageId: number = -1;
                let breakable: (() => void) | null = null;
                pubsub.subscribe('chat_' + conversationId, (msg) => {
                    lastMessageId = msg.eventId;
                    if (breakable) {
                        breakable();
                        breakable = null;
                    }
                });
                while (true) {
                    let delay = delayBreakable(1000);
                    breakable = delay.resolver;
                    await delay.promise;
                    if (lastMessageId !== -1) {
                        let msg = lastMessageId;
                        lastMessageId = -1;
                        console.warn(msg);
                        yield msg;
                    }
                }
            }
        }
    }
};
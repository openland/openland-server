import { ConversationMessage } from '../tables/ConversationMessage';
import { IDs } from './utils/IDs';
import { Conversation } from '../tables/Conversation';
import { DB } from '../tables';
import { withPermission, withAny, withAccount } from './utils/Resolvers';
import { validate, stringNotEmpty } from '../modules/NewInputValidator';
import { Pubsub } from '../modules/pubsub';
import { delayBreakable } from '../utils/timer';

let pubsub = new Pubsub<{ messageId: number }>();

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
            return DB.ConversationMessage.findAll({
                where: {
                    conversationId: conversationId
                },
                order: [['createdAt', 'DESC']]
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
            let res = await DB.ConversationMessage.create({
                message: args.message,
                conversationId: conversationId,
                userId: uid
            });
            pubsub.publish('chat_' + conversationId, { messageId: res.id });
            return res;
        })
    },
    Subscription: {
        alphaChatSubscribe: {
            resolve: async (msg: number) => {
                console.warn(msg);
                return DB.ConversationMessage.findById(msg);
            },
            subscribe: async function* (_: any, args: { conversationId: string }) {
                let conversationId = IDs.Conversation.parse(args.conversationId);
                let lastMessageId: number = -1;
                let breakable: (() => void) | null = null;
                pubsub.subscribe('chat_' + conversationId, (msg) => {
                    lastMessageId = msg.messageId;
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
                        yield msg;
                    }
                }
            }
        }
    }
};
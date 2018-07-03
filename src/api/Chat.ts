import { ConversationMessage } from '../tables/ConversationMessage';
import { IDs } from './utils/IDs';
import { Conversation } from '../tables/Conversation';
import { DB } from '../tables';
import { withPermission, withAny, withAccount } from './utils/Resolvers';
import { validate, stringNotEmpty } from '../modules/NewInputValidator';

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
        alphaSendMessage: withAccount<{ conversationId: string, message: string }>((args, uid) => {
            validate({ message: stringNotEmpty() }, args);
            let conversationId = IDs.Conversation.parse(args.conversationId);
            return DB.ConversationMessage.create({
                message: args.message,
                conversationId: conversationId,
                userId: uid
            });
        })
    }
};
import { Modules } from 'openland-modules/Modules';
import { IDs } from 'openland-module-api/IDs';
import { CallContext } from 'openland-module-api/CallContext';
import { withUser } from 'openland-module-api/Resolvers';
import { validate, optional, enumString } from 'openland-utils/NewInputValidator';
import { TypingEvent } from './TypingEvent';
import { FDB } from 'openland-module-db/FDB';
import { GQL } from '../openland-module-api/schema/SchemaSpec';

export default {
    TypingType: {
        TEXT: 'text',
        PHOTO: 'photo',
        FILE: 'file'
    },
    TypingEvent: {
        type: (src: TypingEvent) => src.type,
        cancel: (src: TypingEvent) => src.cancel,
        conversation: (src: TypingEvent) => FDB.Conversation.findById(src.conversationId),
        user: (src: TypingEvent) => src.userId,
    },
    Mutation: {
        alphaSetTyping: withUser<GQL.MutationAlphaSetTypingArgs>(async (args, uid) => {
            await validate({ type: optional(enumString(['text', 'photo'])) }, args);
            let conversationId = IDs.Conversation.parse(args.conversationId);
            await Modules.Typings.setTyping(uid, conversationId, args.type || 'text');
            return 'ok';
        }),
        typingSend: withUser<GQL.MutationTypingSendArgs>(async (args, uid) => {
            await validate({ type: optional(enumString(['text', 'photo'])) }, args);
            let conversationId = IDs.Conversation.parse(args.conversationId);
            await Modules.Typings.setTyping(uid, conversationId, args.type || 'text');
            return 'ok';
        }),
        typingCancel: withUser<GQL.MutationTypingCancelArgs>(async (args, uid) => {
            let chatId = IDs.Conversation.parse(args.conversationId);
            let members = await Modules.Messaging.conv.findConversationMembers(chatId);
            await Modules.Typings.cancelTyping(uid, chatId, members);
            return 'ok';
        }),
    },
    Subscription: {
        typings: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async function (_: any, args: any, context: CallContext) {
                if (!context.uid) {
                    throw Error('Not logged in');
                }

                return Modules.Typings.createTypingStream(context.uid);
            }
        },
        conversationTypings: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async function (_: any, args: { conversationId: string }, context: CallContext) {
                let conversationId = IDs.Conversation.parse(args.conversationId);

                if (!context.uid) {
                    throw Error('Not logged in');
                }

                return Modules.Typings.createTypingStream(context.uid, conversationId);
            }
        },
        alphaSubscribeTypings: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async function (_: any, args: any, context: CallContext) {
                if (!context.uid) {
                    throw Error('Not logged in');
                }

                return Modules.Typings.createTypingStream(context.uid);
            }
        },
        alphaSubscribeChatTypings: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async function (_: any, args: { conversationId: string }, context: CallContext) {
                let conversationId = IDs.Conversation.parse(args.conversationId);

                if (!context.uid) {
                    throw Error('Not logged in');
                }

                return Modules.Typings.createTypingStream(context.uid, conversationId);
            }
        },
    }
};
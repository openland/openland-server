import { Modules } from 'openland-modules/Modules';
import { IDs } from 'openland-server/api/utils/IDs';
import { CallContext } from 'openland-server/api/utils/CallContext';
import { withUser } from 'openland-server/api/utils/Resolvers';
import { validate, optional, enumString } from 'openland-utils/NewInputValidator';

export default {
    TypingType: {
        TEXT: 'text',
        PHOTO: 'photo',
        FILE: 'file'
    },
    Mutation: {
        alphaSetTyping: withUser<{ conversationId: string, type: 'text' | 'photo' | 'file' }>(async (args, uid) => {
            await validate({ type: optional(enumString(['text', 'photo'])) }, args);
            let conversationId = IDs.Conversation.parse(args.conversationId);
            await Modules.Typings.setTyping(uid, conversationId, args.type || 'text');
            return 'ok';
        }),
        typingSend: withUser<{ conversationId: string, type: 'text' | 'photo' | 'file' }>(async (args, uid) => {
            await validate({ type: optional(enumString(['text', 'photo'])) }, args);
            let conversationId = IDs.Conversation.parse(args.conversationId);
            await Modules.Typings.setTyping(uid, conversationId, args.type || 'text');
            return 'ok';
        }),
        typingCancel: withUser<{ conversationId: number }>(async (args, uid) => {
            let members = await Modules.Messaging.conv.findConversationMembers(args.conversationId);
            await Modules.Typings.cancelTyping(uid, args.conversationId, members);
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